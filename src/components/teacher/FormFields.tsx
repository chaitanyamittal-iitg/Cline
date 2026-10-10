"use client";
// Small accessible form building blocks for the teacher action forms. TEACHER-OWNED. Client only.
// Every field has a visible label, optional help text, an error tied to the field with aria-describedby,
// and a live character count against the contract's real limit.
import { useId } from "react";
import styles from "./teacher.module.css";

export function TextArea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  error?: string;
  help?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const describedBy = [props.help ? `${id}-help` : "", props.error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id}>
        {props.label}
        {props.required ? " (required)" : " (optional)"}
      </label>
      <textarea
        id={id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        disabled={props.disabled}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={props.required ? true : undefined}
        maxLength={props.max + 500} /* soft guard only; the exact limit is checked and explained below */
      />
      {props.help && (
        <p id={`${id}-help`} className={styles.fieldHelp}>
          {props.help}
        </p>
      )}
      <p className={styles.fieldHelp} aria-live="polite">
        {props.value.trim().length} / {props.max} characters
      </p>
      {props.error && (
        <p id={`${id}-err`} className={styles.fieldError} role="alert">
          {props.error}
        </p>
      )}
    </div>
  );
}

export function Checkbox(props: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label className={styles.checkRow} htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={props.checked}
          onChange={(event) => props.onChange(event.target.checked)}
          disabled={props.disabled}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? `${id}-err` : undefined}
        />
        <span>{props.label}</span>
      </label>
      {props.error && (
        <p id={`${id}-err`} className={styles.fieldError} role="alert">
          {props.error}
        </p>
      )}
    </div>
  );
}

export function SubmitRow(props: { pending: boolean; label: string; pendingLabel: string; disabled?: boolean }) {
  return (
    <div className={styles.formActions}>
      <button
        type="submit"
        className={`btn ${props.pending ? styles.btnPending : ""}`}
        disabled={props.pending || props.disabled}
        aria-disabled={props.pending || props.disabled}
      >
        {props.pending ? props.pendingLabel : props.label}
      </button>
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className={styles.fieldError} role="alert">
      {message}
    </p>
  );
}
