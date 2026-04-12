'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import type { CatalogDifficultyTone, CatalogText } from "@/lib/text-catalog";

type DifficultyOption = {
  id_text_dif: number;
  text_dif_desc: string;
  text_dif_level: number;
  text_dif_color: CatalogDifficultyTone;
};

type FormMode = "idle" | "create" | "edit";

type TextFormState = {
  id: number | null;
  text_title: string;
  text_desc: string;
  text_difficulty_id: string;
  is_active: boolean;
};

const emptyTextForm: TextFormState = {
  id: null,
  text_title: "",
  text_desc: "",
  text_difficulty_id: "",
  is_active: true,
};

export default function TextCatalogModal({
  open,
  texts,
  selectedIndex,
  onSelect,
  onClose,
  loading,
  canManage,
  onCatalogRefresh,
}: {
  open: boolean;
  texts: CatalogText[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  loading: boolean;
  canManage?: boolean;
  onCatalogRefresh?: () => Promise<void> | void;
}) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [sortMode, setSortMode] = useState<"difficulty" | "length" | "words">("difficulty");
  const [formMode, setFormMode] = useState<FormMode>("idle");
  const [textForm, setTextForm] = useState<TextFormState>(emptyTextForm);
  const [difficultyOptions, setDifficultyOptions] = useState<DifficultyOption[]>([]);
  const [difficultyLoading, setDifficultyLoading] = useState(false);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [manageMessage, setManageMessage] = useState("");

  const fallbackDifficultyOptions = useMemo(() => {
    const map = new Map<number, DifficultyOption>();

    texts.forEach((text) => {
      if (map.has(text.difficulty.id)) {
        return;
      }

      map.set(text.difficulty.id, {
        id_text_dif: text.difficulty.id,
        text_dif_desc: text.difficulty.label,
        text_dif_level: text.difficulty.level,
        text_dif_color: text.difficulty.tone,
      });
    });

    return [...map.values()].sort((left, right) => left.text_dif_level - right.text_dif_level);
  }, [texts]);

  const availableDifficulties = difficultyOptions.length > 0 ? difficultyOptions : fallbackDifficultyOptions;

  const draftWordCount = useMemo(() => {
    const trimmed = textForm.text_desc.trim();
    return trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;
  }, [textForm.text_desc]);

  const handleClose = useCallback(() => {
    setSearch("");
    setViewMode("list");
    setSortMode("difficulty");
    setFormMode("idle");
    setTextForm(emptyTextForm);
    setManageMessage("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, open]);

  const filteredTexts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const prepared = texts
      .map((text, index) => {
        const estimatedSeconds = Math.max(8, Math.ceil((text.wordCount / 45) * 60));
        const lengthLabel =
          text.characterCount < 140 ? "Corto" : text.characterCount < 260 ? "Medio" : "Largo";

        return {
          index,
          text,
          estimatedSeconds,
          lengthLabel,
        };
      })
      .filter(({ text }) => {
        if (!query) {
          return true;
        }

        const searchable = `${text.title} ${text.text} ${text.difficulty.label}`.toLowerCase();
        return searchable.includes(query);
      });

    prepared.sort((left, right) => {
      if (sortMode === "length") {
        return right.text.characterCount - left.text.characterCount;
      }

      if (sortMode === "words") {
        return right.text.wordCount - left.text.wordCount;
      }

      return left.text.difficulty.level - right.text.difficulty.level;
    });

    return prepared;
  }, [search, sortMode, texts]);

  async function readResponseMessage(response: Response, fallback: string) {
    try {
      const payload = (await response.json()) as { message?: string };
      return payload.message ?? fallback;
    } catch {
      return fallback;
    }
  }

  async function ensureDifficulties() {
    if (difficultyOptions.length > 0) {
      return difficultyOptions;
    }

    setDifficultyLoading(true);

    try {
      const response = await fetch("/api/admin/text-difficulty", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, "No se pudo cargar la lista de dificultades."));
      }

      const payload = (await response.json()) as { difficulties?: DifficultyOption[] };
      const next = payload.difficulties ?? [];

      if (next.length > 0) {
        setDifficultyOptions(next);
        return next;
      }

      return fallbackDifficultyOptions;
    } catch (error) {
      setManageMessage(error instanceof Error ? error.message : "No se pudo cargar la lista de dificultades.");
      return fallbackDifficultyOptions;
    } finally {
      setDifficultyLoading(false);
    }
  }

  async function openCreateForm() {
    const options = await ensureDifficulties();

    setFormMode("create");
    setTextForm({
      ...emptyTextForm,
      text_difficulty_id: options[0] ? String(options[0].id_text_dif) : "",
      is_active: true,
    });
    setManageMessage("");
  }

  async function openEditFormForText(targetText: CatalogText) {
    const options = await ensureDifficulties();
    const matchedDifficulty = options.find((option) => option.id_text_dif === targetText.difficulty.id);

    setFormMode("edit");
    setTextForm({
      id: targetText.id,
      text_title: targetText.title,
      text_desc: targetText.text,
      text_difficulty_id: String(matchedDifficulty?.id_text_dif ?? targetText.difficulty.id),
      is_active: true,
    });
    setManageMessage("");
  }

  function cancelEdition() {
    setFormMode("idle");
    setTextForm(emptyTextForm);
    setManageMessage("");
  }

  async function saveTextForm() {
    const title = textForm.text_title.trim();
    const description = textForm.text_desc.trim();
    const difficultyId = Number(textForm.text_difficulty_id);

    if (!title || !description || !Number.isFinite(difficultyId)) {
      setManageMessage("Completa título, texto y dificultad antes de guardar.");
      return;
    }

    setMutationLoading(true);
    setManageMessage("");

    try {
      const payload = {
        text_title: title,
        text_desc: description,
        text_difficulty_id: difficultyId,
        is_active: textForm.is_active,
      };

      const response = textForm.id
        ? await fetch(`/api/admin/texts/${textForm.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/texts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const apiMessage = await readResponseMessage(
        response,
        textForm.id ? "No se pudo actualizar el texto." : "No se pudo crear el texto.",
      );

      if (!response.ok) {
        throw new Error(apiMessage);
      }

      await onCatalogRefresh?.();
      setFormMode("idle");
      setTextForm(emptyTextForm);
      setManageMessage(apiMessage);
    } catch (error) {
      setManageMessage(error instanceof Error ? error.message : "No se pudo guardar el texto.");
    } finally {
      setMutationLoading(false);
    }
  }

  async function deleteTextById(textId: number, textTitle: string) {
    const confirmed = window.confirm(`Se eliminará el texto \"${textTitle}\". ¿Deseas continuar?`);

    if (!confirmed) {
      return;
    }

    setMutationLoading(true);
    setManageMessage("");

    try {
      const response = await fetch(`/api/admin/texts/${textId}`, { method: "DELETE" });
      const apiMessage = await readResponseMessage(response, "No se pudo eliminar el texto.");

      if (!response.ok) {
        throw new Error(apiMessage);
      }

      if (textForm.id === textId) {
        setFormMode("idle");
        setTextForm(emptyTextForm);
      }

      await onCatalogRefresh?.();
      setManageMessage(apiMessage);
    } catch (error) {
      setManageMessage(error instanceof Error ? error.message : "No se pudo eliminar el texto.");
    } finally {
      setMutationLoading(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4">
      <button
        type="button"
        aria-label="Cerrar selector de textos"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
        onClick={handleClose}
      />

      <section className="relative z-10 w-full max-w-5xl overflow-hidden rounded-4xl border border-slate-200 bg-white/95 shadow-[0_40px_120px_rgba(15,34,64,0.22)] backdrop-blur-xl">
        <div className="h-1 bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))]" />
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-(--accent-strong)">Biblioteca de textos</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Selecciona el texto de la partida</h2>
            
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto px-4 py-4 sm:px-6 sm:py-5">
          {canManage ? (
            <>
              {/*
              <div className="mb-4 grid gap-3 rounded-3xl border border-slate-200 bg-white/85 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Gestiona aquí mismo: crear, modificar y eliminar por fila.
                  </p>
                </div>
              </div>
              */}

              {manageMessage ? (
                <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{manageMessage}</div>
              ) : null}

              {formMode !== "idle" ? (
                <div className="mb-4 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {formMode === "create" ? "Crear nuevo texto" : `Editar texto #${textForm.id ?? ""}`}
                    </h3>
                    <button
                      type="button"
                      onClick={cancelEdition}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_140px]">
                    <label className="grid gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Título</span>
                      <input
                        value={textForm.text_title}
                        onChange={(event) => setTextForm((current) => ({ ...current, text_title: event.target.value }))}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-(--accent-strong)"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Dificultad</span>
                      <select
                        value={textForm.text_difficulty_id}
                        onChange={(event) =>
                          setTextForm((current) => ({ ...current, text_difficulty_id: event.target.value }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-(--accent-strong)"
                      >
                        <option value="">Selecciona dificultad</option>
                        {availableDifficulties.map((difficulty) => (
                          <option key={difficulty.id_text_dif} value={difficulty.id_text_dif}>
                            {difficulty.text_dif_desc} (nivel {difficulty.text_dif_level})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={textForm.is_active}
                        onChange={(event) => setTextForm((current) => ({ ...current, is_active: event.target.checked }))}
                        className="h-4 w-4 accent-(--accent-strong)"
                      />
                      <span className="text-sm font-medium text-slate-700">Activo</span>
                    </label>
                  </div>

                  <label className="grid gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Texto</span>
                    <textarea
                      rows={5}
                      value={textForm.text_desc}
                      onChange={(event) => setTextForm((current) => ({ ...current, text_desc: event.target.value }))}
                      className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-(--accent-strong)"
                    />
                  </label>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <MetaPill label="Palabras" value={String(draftWordCount)} />
                    <MetaPill label="Caracteres" value={String(textForm.text_desc.length)} />
                    <MetaPill
                      label="Longitud"
                      value={textForm.text_desc.length < 140 ? "Corto" : textForm.text_desc.length < 260 ? "Medio" : "Largo"}
                    />
                    <MetaPill label="Estado" value={textForm.is_active ? "Activo" : "Inactivo"} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveTextForm}
                      disabled={mutationLoading || difficultyLoading}
                      className="rounded-full border border-(--accent-strong)/20 bg-(--accent-strong) px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {formMode === "create" ? "Guardar texto" : "Guardar cambios"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdition}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancelar edición
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mb-4 rounded-3xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600">
              Solo el maestro puede gestionar textos desde este modal.
            </div>
          )}

          <div
            className={`mb-4 grid gap-3 rounded-3xl border border-slate-200 bg-white/85 p-3 sm:items-center sm:p-4 ${
              canManage
                ? "sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
                : "sm:grid-cols-[minmax(0,1fr)_auto_auto]"
            }`}
          >
            {canManage ? (
              <button
                type="button"
                onClick={openCreateForm}
                disabled={mutationLoading || difficultyLoading}
                className="rounded-full border border-(--accent)/20 bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Nuevo
              </button>
            ) : null}

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título, contenido o dificultad"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-(--accent-strong)"
            />

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as "difficulty" | "length" | "words")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-(--accent-strong)"
            >
              <option value="difficulty">Orden: dificultad</option>
              <option value="length">Orden: longitud</option>
              <option value="words">Orden: palabras</option>
            </select>

            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  viewMode === "list" ? "bg-(--accent-strong)/10 text-(--accent-strong)" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Listado
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  viewMode === "cards" ? "bg-(--accent)/10 text-(--accent)" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Tarjetas
              </button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-slate-600">
              Cargando textos desde la base de datos...
            </div>
          ) : filteredTexts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-slate-600">
              No hay textos que coincidan con la búsqueda.
            </div>
          ) : viewMode === "list" ? (
            <div className="grid gap-2">
              {filteredTexts.map(({ index, text, estimatedSeconds, lengthLabel }) => {
                const selected = index === selectedIndex;

                return (
                  <article
                    key={text.id}
                    className={`rounded-3xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-(--accent-strong)/25 bg-(--accent-strong)/8"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <button type="button" onClick={() => onSelect(index)} className="w-full text-left">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(96px,auto))] lg:items-center">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Texto {text.id}</p>
                          <h3 className="mt-1 text-lg font-semibold text-foreground">{text.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{text.text}</p>
                        </div>

                        <MetricBox label="Dificultad" value={text.difficulty.label} />
                        <MetricBox label="Nivel" value={String(text.difficulty.level)} />
                        <MetricBox label="Palabras" value={String(text.wordCount)} />
                        <MetricBox label="Caracteres" value={String(text.characterCount)} />
                        <MetricBox label="Longitud" value={`${lengthLabel} · ${estimatedSeconds}s`} />
                      </div>
                    </button>

                    {canManage ? (
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void openEditFormForText(text);
                          }}
                          disabled={mutationLoading || difficultyLoading}
                          className="rounded-full border border-(--accent-strong)/20 bg-(--accent-strong)/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-(--accent-strong) transition hover:bg-(--accent-strong)/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void deleteTextById(text.id, text.title);
                          }}
                          disabled={mutationLoading}
                          className="rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredTexts.map(({ index, text, estimatedSeconds, lengthLabel }) => {
                const selected = index === selectedIndex;

                return (
                  <button
                    key={text.id}
                    type="button"
                    onClick={() => onSelect(index)}
                    className={`rounded-3xl border p-5 text-left transition ${
                      selected
                        ? text.difficulty.tone === "emerald"
                          ? "border-emerald-300/40 bg-emerald-300/10"
                          : text.difficulty.tone === "amber"
                            ? "border-amber-300/40 bg-amber-300/10"
                            : "border-rose-300/40 bg-rose-300/10"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Texto {text.id}</p>
                        <h3 className="mt-2 text-xl font-semibold text-foreground">{text.title}</h3>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em] ${
                          text.difficulty.tone === "emerald"
                            ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-700"
                            : text.difficulty.tone === "amber"
                              ? "border-amber-300/30 bg-amber-300/10 text-amber-700"
                              : "border-rose-300/30 bg-rose-300/10 text-rose-700"
                        }`}
                      >
                        {text.difficulty.label}
                      </span>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-600">{text.text}</p>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <MetaPill label="Palabras" value={String(text.wordCount)} />
                      <MetaPill label="Caracteres" value={String(text.characterCount)} />
                      <MetaPill label="Nivel" value={String(text.difficulty.level)} />
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-slate-500">
                      <span>{lengthLabel} · ~{estimatedSeconds}s</span>
                      <span>{selected ? "Seleccionado" : "Disponible"}</span>
                    </div>

                    {canManage ? (
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void openEditFormForText(text);
                          }}
                          disabled={mutationLoading || difficultyLoading}
                          className="rounded-full border border-(--accent-strong)/20 bg-(--accent-strong)/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-(--accent-strong) transition hover:bg-(--accent-strong)/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteTextById(text.id, text.title);
                          }}
                          disabled={mutationLoading}
                          className="rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
