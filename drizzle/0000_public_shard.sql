CREATE TABLE "alertas" (
	"id" serial PRIMARY KEY NOT NULL,
	"reto_id" text NOT NULL,
	"tipo" text NOT NULL,
	"severidad" text NOT NULL,
	"mensaje" text NOT NULL,
	"contexto" jsonb,
	"generada_at" timestamp DEFAULT now() NOT NULL,
	"resuelta_at" timestamp,
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fichas_mensuales" (
	"id" serial PRIMARY KEY NOT NULL,
	"reto_id" text NOT NULL,
	"mes" text NOT NULL,
	"nombre" text,
	"objetivo" text,
	"fecha_lanzamiento" text,
	"area_tematica" text,
	"tipo_reto" text,
	"entidades_impulsoras" text,
	"entidades_participantes" text,
	"contexto_urbano" text,
	"kpis" jsonb,
	"documentacion_asociada" text,
	"estado_actual" text,
	"observaciones" text,
	"fecha_seguimiento" date,
	"fecha_seguimiento_raw" text,
	"hitos_alcanzados" text,
	"riesgos_principales" text,
	"issues_abiertos" text,
	"proximos_pasos" text,
	"meta_programa" text,
	"meta_owner_tecnico_vic" text,
	"meta_seguimiento_tecnico_vic" text,
	"meta_servicios_municipales" text,
	"meta_cuenta_analitica" text,
	"meta_presupuesto" integer,
	"meta_presupuesto_raw" text,
	"meta_plazo" text,
	"sharepoint_path" text,
	"sharepoint_web_url" text,
	"sharepoint_drive_item_id" text,
	"sharepoint_modified_at" timestamp,
	"parser_status" text,
	"parser_warnings" jsonb,
	"raw_text" text,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retos" (
	"id" text PRIMARY KEY NOT NULL,
	"codigo" integer NOT NULL,
	"nombre" text NOT NULL,
	"area" text,
	"owner_municipal" text,
	"owner_tecnico_vic" text,
	"seguimiento_tecnico_vic" text,
	"presupuesto" integer,
	"fecha_inicio" date,
	"fecha_fin" date,
	"empresa_adjudicataria" text,
	"solucion" text,
	"estado_global" text,
	"ficha_mas_reciente" text,
	"ultima_actualizacion" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"status" text NOT NULL,
	"fichas_procesadas" integer DEFAULT 0 NOT NULL,
	"fichas_nuevas" integer DEFAULT 0 NOT NULL,
	"fichas_actualizadas" integer DEFAULT 0 NOT NULL,
	"errores" jsonb,
	"trigger" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_reto_id_retos_id_fk" FOREIGN KEY ("reto_id") REFERENCES "public"."retos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_mensuales" ADD CONSTRAINT "fichas_mensuales_reto_id_retos_id_fk" FOREIGN KEY ("reto_id") REFERENCES "public"."retos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alertas_reto_activa_idx" ON "alertas" USING btree ("reto_id","activa");--> statement-breakpoint
CREATE UNIQUE INDEX "fichas_mensuales_reto_mes_uniq" ON "fichas_mensuales" USING btree ("reto_id","mes");--> statement-breakpoint
CREATE INDEX "fichas_mensuales_reto_mes_idx" ON "fichas_mensuales" USING btree ("reto_id","mes");