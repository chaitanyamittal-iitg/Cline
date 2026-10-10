// Shows stored text exactly as written: wording untouched, line breaks kept, long words wrapped. TEACHER-OWNED.
// React escapes the text, so stored content can never inject markup.
import styles from "./teacher.module.css";

export function Multiline({ text }: { text: string }) {
  return <p className={styles.multiline}>{text}</p>;
}
