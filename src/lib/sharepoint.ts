// Conector a SharePoint vía Microsoft Graph.
// Auth: device code flow con el client_id público de Microsoft Graph PowerShell.
// IMPORTANTE: NO requiere Azure AD App Registration en el tenant — el client_id
// 14d82eec-... es el del módulo "Microsoft Graph PowerShell", público y reutilizable.

import { PublicClientApplication, type Configuration, type AuthenticationResult } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';

// --- Constantes ---

const CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e';      // Microsoft Graph PowerShell (público)
const TENANT_ID = 'common';                                     // multi-tenant; sirve para cuentas de trabajo
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`;
const SCOPES = ['Sites.Read.All', 'Files.Read.All', 'offline_access'];

const SITE_HOSTNAME = 'lasnavesvlc.sharepoint.com';
const SITE_PATH = '/sites/RetosInternos';
const LIBRARY_ROOT_FOLDER = 'RETOS INTERNOS';                   // nombre exacto de la carpeta raíz dentro de la biblioteca

// --- Auth (msal-node) ---

let _msal: PublicClientApplication | null = null;

function getMsal(): PublicClientApplication {
  if (_msal) return _msal;
  const config: Configuration = {
    auth: { clientId: CLIENT_ID, authority: AUTHORITY },
  };
  _msal = new PublicClientApplication(config);
  return _msal;
}

let _cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  // Escape hatch para tests/CI: token directo vía env (sin OAuth).
  const direct = process.env.SHAREPOINT_ACCESS_TOKEN;
  if (direct) return direct;

  // Cache en memoria (margen de 60s antes de la expiración)
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 60_000) {
    return _cachedToken.token;
  }

  const refreshToken = process.env.SHAREPOINT_REFRESH_TOKEN;

  let result: AuthenticationResult | null;

  if (refreshToken) {
    result = await getMsal().acquireTokenByRefreshToken({
      refreshToken,
      scopes: SCOPES,
    });
  } else {
    // Sin refresh token: device code flow. Por defecto solo se permite en TTY
    // (para que cron de Vercel no se quede colgado). SHAREPOINT_INTERACTIVE=1
    // bypasses ese guard cuando se llama desde un script explícitamente interactivo.
    const interactive = process.stdout.isTTY || process.env.SHAREPOINT_INTERACTIVE === '1';
    if (!interactive) {
      throw new Error(
        'SHAREPOINT_REFRESH_TOKEN no configurado y el entorno no es interactivo. ' +
        'Ejecuta `npm run sp:auth` localmente para obtener el refresh token, o ' +
        'define SHAREPOINT_ACCESS_TOKEN como escape hatch.',
      );
    }
    result = await runDeviceCodeFlow();
  }

  if (!result?.accessToken) {
    throw new Error('Token MSAL inválido o flujo de auth no devolvió access token');
  }

  _cachedToken = {
    token: result.accessToken,
    expiresAt: result.expiresOn?.getTime() ?? Date.now() + 50 * 60_000,
  };

  return result.accessToken;
}

async function runDeviceCodeFlow(): Promise<AuthenticationResult | null> {
  const msal = getMsal();

  console.log('\n────────────────────────────────────────────────────────');
  console.log('  Autenticación SharePoint vía device code flow');
  console.log('────────────────────────────────────────────────────────\n');

  const result = await msal.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (resp) => {
      console.log(resp.message);
      console.log();
      // Persistimos el mensaje en disco para que un proceso paralelo
      // (ej. el agente que orquesta el flow) pueda leerlo sin tener stdout.
      try {
        const fs = require('node:fs') as typeof import('node:fs');
        const os = require('node:os') as typeof import('node:os');
        const path = require('node:path') as typeof import('node:path');
        fs.writeFileSync(path.join(os.tmpdir(), 'vic-device-code.txt'), resp.message, 'utf8');
      } catch {
        /* ignore */
      }
    },
  });

  if (!result?.accessToken) return result;

  // msal-node no expone refreshToken en el AuthenticationResult.
  // Lo extraemos del cache serializado para imprimirlo.
  try {
    const cacheStr = msal.getTokenCache().serialize();
    const cacheJson = JSON.parse(cacheStr || '{}') as {
      RefreshToken?: Record<string, { secret?: string }>;
    };
    const refreshTokens = Object.values(cacheJson.RefreshToken ?? {});
    const refreshToken = refreshTokens[0]?.secret;

    if (refreshToken) {
      console.log('\n────────────────────────────────────────────────────────');
      console.log('  REFRESH TOKEN (guárdalo como SHAREPOINT_REFRESH_TOKEN)');
      console.log('────────────────────────────────────────────────────────');
      console.log(refreshToken);
      console.log('────────────────────────────────────────────────────────');
      console.log('Pégalo en .env.local Y en las env vars de Vercel.\n');
    } else {
      console.warn('⚠ No se pudo extraer refresh token del cache de msal-node.');
    }
  } catch (e) {
    console.warn('⚠ Error extrayendo refresh token:', (e as Error).message);
  }

  return result;
}

// --- Microsoft Graph client ---

async function getGraphClient(): Promise<Client> {
  return Client.init({
    authProvider: (done) => {
      getAccessToken()
        .then((token) => done(null, token))
        .catch((err) => done(err as Error, null));
    },
  });
}

let _cachedSiteId: string | null = null;

async function getSiteId(): Promise<string> {
  if (_cachedSiteId) return _cachedSiteId;
  const client = await getGraphClient();
  const site = await client.api(`/sites/${SITE_HOSTNAME}:${SITE_PATH}`).get();
  _cachedSiteId = site.id as string;
  return _cachedSiteId;
}

// --- API pública: listar y descargar fichas ---

export interface FichaInfo {
  driveItemId: string;
  filename: string;
  webUrl: string;
  carpetaMes: string;       // "04 Abril 2026"
  mes: string;              // "2026-04" (carpetaMesToYM aplicado)
  modifiedAt: Date;
  size: number;
}

/**
 * Lista todas las fichas .docx en `<site>/Shared Documents/RETOS INTERNOS/<MM Mes AAAA>/`.
 * Recorre cada subcarpeta mensual y devuelve un FichaInfo por archivo.
 */
export async function listFichas(): Promise<FichaInfo[]> {
  const client = await getGraphClient();
  const siteId = await getSiteId();

  // Listar carpetas mensuales dentro de "RETOS INTERNOS"
  const monthsResp = await client
    .api(`/sites/${siteId}/drive/root:/${encodeURIComponent(LIBRARY_ROOT_FOLDER)}:/children`)
    .top(200)
    .get();

  const fichas: FichaInfo[] = [];

  for (const item of monthsResp.value as Array<Record<string, unknown>>) {
    if (!item.folder) continue;
    const carpetaMes = item.name as string;
    const mes = carpetaMesToYM(carpetaMes);
    if (!mes) continue;

    const filesResp = await client
      .api(`/sites/${siteId}/drive/items/${item.id}/children`)
      .top(200)
      .get();

    for (const file of filesResp.value as Array<Record<string, unknown>>) {
      if (!file.file) continue;
      const filename = file.name as string;
      if (!/\.docx$/i.test(filename)) continue;

      fichas.push({
        driveItemId: file.id as string,
        filename,
        webUrl: (file.webUrl as string) ?? '',
        carpetaMes,
        mes,
        modifiedAt: new Date(file.lastModifiedDateTime as string),
        size: (file.size as number) ?? 0,
      });
    }
  }

  return fichas;
}

/**
 * Descarga el .docx de un driveItem como Buffer.
 * Usa el @microsoft.graph.downloadUrl pre-firmado (no requiere auth para la descarga).
 */
export async function downloadFicha(driveItemId: string): Promise<Buffer> {
  const client = await getGraphClient();
  const siteId = await getSiteId();

  const item = await client
    .api(`/sites/${siteId}/drive/items/${driveItemId}`)
    .select('id,name,@microsoft.graph.downloadUrl')
    .get();

  const downloadUrl = item['@microsoft.graph.downloadUrl'] as string | undefined;
  if (!downloadUrl) {
    throw new Error(`No se obtuvo @microsoft.graph.downloadUrl para item ${driveItemId}`);
  }

  const resp = await fetch(downloadUrl);
  if (!resp.ok) {
    throw new Error(`Descarga de ${driveItemId} falló con status ${resp.status}`);
  }

  return Buffer.from(await resp.arrayBuffer());
}

// --- Helpers ---

const SPANISH_MONTHS_SP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/**
 * Convierte el nombre de carpeta mensual ("04 Abril 2026") a YYYY-MM.
 * Tolera el typo conocido "03 Marzo 2006" → "2026-03" (CONTEXTO §1).
 * Devuelve null si la carpeta no encaja en el patrón.
 */
export function carpetaMesToYM(carpetaMes: string): string | null {
  const trimmed = carpetaMes.trim();

  // Caso especial documentado: "03 Marzo 2006" debería ser 2026
  if (/^03\s+marzo\s+2006$/i.test(trimmed)) return '2026-03';

  const m = trimmed.match(/^(\d{1,2})\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+(\d{4})$/);
  if (!m) return null;

  const monthNum = parseInt(m[1], 10);
  const monthName = m[2].toLowerCase();
  const year = parseInt(m[3], 10);

  // Validación de cordura
  if (monthNum < 1 || monthNum > 12) return null;
  if (year < 2020 || year > 2030) return null;
  // El nombre del mes debería coincidir con el número (best-effort)
  const monthByName = SPANISH_MONTHS_SP[monthName];
  if (monthByName && monthByName !== monthNum) {
    // Inconsistencia: confiamos en el número (más fiable que el nombre)
  }

  return `${year}-${String(monthNum).padStart(2, '0')}`;
}
