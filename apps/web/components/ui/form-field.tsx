import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import styles from "./form-field.module.css";

type FieldProps = {
  label: string;
  name: string;
  error?: string;
};

type InputFieldProps = FieldProps & Omit<ComponentPropsWithRef<"input">, "type" | "children"> & {
  type?: "text" | "email" | "password";
  children?: never;
};

type SelectFieldProps = FieldProps & Omit<ComponentPropsWithRef<"select">, "children"> & {
  type: "select";
  placeholder?: string;
  children?: ReactNode;
};

export type FormFieldProps = InputFieldProps | SelectFieldProps;

export function FormField({ label, error, ...props }: FormFieldProps) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const errorId = `${id}-error`;
  const description = [props["aria-describedby"], error ? errorId : undefined].filter(Boolean).join(" ") || undefined;
  const controlProps = {
    id,
    "aria-invalid": error ? true : props["aria-invalid"],
    "aria-describedby": description,
    className: [styles.control, props.className].filter(Boolean).join(" ")
  };

  let control: ReactNode;
  if (props.type === "select") {
    const { type, placeholder, children, ...selectProps } = props;
    control = (
      <select {...selectProps} {...controlProps}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {children}
      </select>
    );
  } else {
    const { type = "text", ...inputProps } = props;
    control = <input {...inputProps} {...controlProps} type={type} />;
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}{props.required && <span aria-hidden="true"> *</span>}
      </label>
      {control}
      {error && <p className={styles.error} id={errorId} role="alert">{error}</p>}
    </div>
  );
}
