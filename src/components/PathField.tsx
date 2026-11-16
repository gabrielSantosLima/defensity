import { Button } from "./Button";
import { Field } from "./ui";

interface PathFieldProps {
  id: string;
  label: string;
  value: string;
  mode: "file" | "directory";
  placeholder?: string;
  hint?: string;
  onChange: (value: string) => void;
}

export function PathField({
  id,
  label,
  value,
  mode,
  placeholder,
  hint,
  onChange,
}: PathFieldProps) {
  async function browse() {
    const selected = await window.defensity.pickPath({
      mode,
      title: label,
    });
    if (selected) {
      onChange(selected);
    }
  }

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="path-row">
        <input
          id={id}
          className="input"
          value={value}
          placeholder={placeholder}
          readOnly
        />
        <Button variant="secondary" size="sm" onClick={browse} type="button">
          Browse
        </Button>
        {value ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onChange("")}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </Field>
  );
}
