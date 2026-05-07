import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ID_RE = /^[a-zA-Z0-9_-]{3,32}$/;

function validId(id: string) {
  if (!ID_RE.test(id)) throw new Error("ID inválido. Use 3 a 32 caracteres: letras, números, _ ou -");
}

const TimeEntrySchema = z.object({
  id: z.number(),
  nome: z.string(),
  esquema_id: z.number(),
  jogadores: z.array(z.object({ slotKey: z.string(), posicao_id: z.number(), atleta_id: z.number() })),
  capitao_id: z.number().nullable(),
  reserva_luxo_id: z.number().nullable(),
  pontuacao_final: z.number().nullable(),
  pontuacao_original: z.number().nullable(),
  rodada_calculada: z.number().nullable(),
  indice_confianca: z.number().nullable(),
  oculto: z.boolean(),
  criado_em: z.string(),
});

export const getUserTimes = createServerFn({ method: "GET" })
  .inputValidator(z.object({ user_id: z.string() }))
  .handler(async ({ data }) => {
    validId(data.user_id);
    const { data: row } = await supabaseAdmin
      .from("user_times")
      .select("user_id, times")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!row) return { user_id: data.user_id, times: [], exists: false };
    return { user_id: data.user_id, times: (row.times as any[]) ?? [], exists: true };
  });

export const setUserTimes = createServerFn({ method: "POST" })
  .inputValidator(z.object({ user_id: z.string(), times: z.array(TimeEntrySchema) }))
  .handler(async ({ data }) => {
    validId(data.user_id);
    const { error } = await supabaseAdmin
      .from("user_times")
      .upsert({ user_id: data.user_id, times: data.times as any, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { user_id: data.user_id, qtd: data.times.length };
  });

export const addUserTime = createServerFn({ method: "POST" })
  .inputValidator(z.object({ user_id: z.string(), time: TimeEntrySchema }))
  .handler(async ({ data }) => {
    validId(data.user_id);
    const { data: row } = await supabaseAdmin
      .from("user_times").select("times").eq("user_id", data.user_id).maybeSingle();
    const arr = ((row?.times as any[]) ?? []).concat([data.time]);
    const { error } = await supabaseAdmin
      .from("user_times")
      .upsert({ user_id: data.user_id, times: arr as any, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { user_id: data.user_id, times: arr };
  });

export const patchUserTime = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    user_id: z.string(),
    time_id: z.number(),
    patch: z.object({
      indice_confianca: z.number().nullable().optional(),
      oculto: z.boolean().optional(),
      nome: z.string().optional(),
    }),
  }))
  .handler(async ({ data }) => {
    validId(data.user_id);
    if (Object.keys(data.patch).length === 0) throw new Error("Nada a atualizar");
    const { data: row } = await supabaseAdmin
      .from("user_times").select("times").eq("user_id", data.user_id).maybeSingle();
    if (!row) throw new Error("Time não encontrado");
    const arr = (row.times as any[]) ?? [];
    const idx = arr.findIndex(t => t.id === data.time_id);
    if (idx === -1) throw new Error("Time não encontrado");
    arr[idx] = { ...arr[idx], ...data.patch };
    const { error } = await supabaseAdmin
      .from("user_times")
      .update({ times: arr as any, updated_at: new Date().toISOString() })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { user_id: data.user_id, times: arr };
  });

export const deleteUserTime = createServerFn({ method: "POST" })
  .inputValidator(z.object({ user_id: z.string(), time_id: z.number() }))
  .handler(async ({ data }) => {
    validId(data.user_id);
    const { data: row } = await supabaseAdmin
      .from("user_times").select("times").eq("user_id", data.user_id).maybeSingle();
    const arr = ((row?.times as any[]) ?? []).filter(t => t.id !== data.time_id);
    const { error } = await supabaseAdmin
      .from("user_times")
      .upsert({ user_id: data.user_id, times: arr as any, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, times: arr };
  });
