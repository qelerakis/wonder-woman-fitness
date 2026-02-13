"use client";

import { forwardRef, useId } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, id, className = "", ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-surface-200"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helpText
                ? `${inputId}-help`
                : undefined
          }
          className={`
            block w-full rounded-lg border px-3 py-2
            bg-surface-800 text-surface-100
            placeholder:text-surface-500
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface-900
            disabled:cursor-not-allowed disabled:opacity-50
            ${
              error
                ? "border-error-500 focus:ring-error-500"
                : "border-surface-600 focus:ring-primary-500 hover:border-surface-500"
            }
            ${className}
          `.trim()}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-sm text-error-500"
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && helpText && (
          <p
            id={`${inputId}-help`}
            className="mt-1.5 text-sm text-surface-400"
          >
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
