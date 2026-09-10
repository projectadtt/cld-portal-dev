"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Choosing a picture.
 *
 * The control is the picture. There is no dashed drop zone and no cloud icon:
 * what fills the frame is either the image on the record, the image about to
 * replace it, or the same typographic plate the rest of the portal shows for a
 * record without one — so the frame reads at every moment as the thing that
 * will be published, not as an upload widget standing in front of it.
 *
 * The actions underneath are the portal's ordinary quiet links rather than
 * buttons, for the same reason the edit link on a product is a link: changing
 * a picture is a small act, and dressing it as a toolbar would give it more
 * weight on the page than the product's own name.
 *
 * Three states are posted, not two. "No file chosen" and "take the existing
 * one away" are the same empty file input, so the intent travels in its own
 * hidden field and the server never has to guess which was meant.
 */
export function ImageField({
  label,
  hint,
  error,
  currentUrl,
  placeholder,
  circle = false,
  className,
}: {
  label: string;
  hint: string;
  error?: string;
  /** The image already on the record, if any. */
  currentUrl: string | null;
  /** What this record shows when it has no image — its real fallback. */
  placeholder: ReactNode;
  /** Portraits and logos sit in a disc; product photographs sit in a square. */
  circle?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [chosenName, setChosenName] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  /* An object URL is a live handle into the browser's memory, so it is
     released when it stops being shown or the field goes away. */
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const showing = preview ?? (removed ? null : currentUrl);
  const hasStored = Boolean(currentUrl) && !removed;

  function choose(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setChosenName(file.name);
    setRemoved(false);
  }

  /** Back to exactly how the record stands in the database. */
  function revert() {
    setPreview(null);
    setChosenName(null);
    setRemoved(false);
    if (input.current) input.current.value = "";
  }

  function remove() {
    setPreview(null);
    setChosenName(null);
    setRemoved(true);
    if (input.current) input.current.value = "";
  }

  return (
    <div className={cn("min-w-0", className)}>
      <span className="type-label block">{label}</span>

      <div className="mt-3 flex flex-wrap items-start gap-x-8 gap-y-5">
        <div
          className={cn(
            "relative w-32 shrink-0 overflow-hidden sm:w-36",
            circle ? "rounded-full" : "",
          )}
        >
          {showing ? (
            <div
              className={cn(
                "relative aspect-square border border-rule bg-surface",
                circle ? "rounded-full" : "",
              )}
            >
              {/* A plain img, not next/image: a blob: URL from the file the
                  person just picked has nothing for an optimiser to fetch. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={showing}
                alt=""
                className={cn(
                  "absolute inset-0 size-full",
                  circle ? "object-contain p-1" : "object-cover",
                )}
              />
            </div>
          ) : (
            placeholder
          )}
        </div>

        <div className="min-w-0 flex-1 basis-48">
          {/* The input itself is never shown. It is reached through its label,
              which is a real control for a keyboard and a screen reader. */}
          <input
            ref={input}
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-describedby={error ? "image-error" : "image-hint"}
            onChange={(event) => choose(event.currentTarget.files)}
          />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label
              htmlFor="image"
              className="cursor-pointer border-b border-rule pb-0.5 text-sm text-ink transition-colors hover:border-forest hover:text-forest focus-within:border-forest"
            >
              {showing ? "Choose a different image" : "Choose an image"}
            </label>

            {hasStored || preview ? (
              <button
                type="button"
                onClick={remove}
                className="text-sm text-ink-muted transition-colors hover:text-red"
              >
                Remove
              </button>
            ) : null}

            {preview || removed ? (
              <button
                type="button"
                onClick={revert}
                className="text-sm text-ink-muted transition-colors hover:text-forest"
              >
                Undo
              </button>
            ) : null}
          </div>

          {error ? (
            <p id="image-error" className="mt-2 text-[13px] leading-5 text-red">
              {error}
            </p>
          ) : (
            <p id="image-hint" className="mt-2 max-w-[36ch] text-[13px] leading-5 text-ink-faint">
              {preview ? (
                <>
                  <span className="text-ink-muted">Not saved yet.</span>{" "}
                  {chosenName} replaces the current image when you save.
                </>
              ) : removed ? (
                <span className="text-ink-muted">
                  The image will be removed when you save.
                </span>
              ) : (
                hint
              )}
            </p>
          )}
        </div>
      </div>

      {/* What the server acts on. Present only when the person asked for the
          existing image to go, so an ordinary save never touches it. */}
      {removed ? <input type="hidden" name="imageAction" value="remove" /> : null}
    </div>
  );
}
