import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import './EditFieldDialog.css';

interface EditFieldDialogProps {
  open: boolean;
  fieldId: string;
  fieldLabel: string;
  modelValue: string;
  currentValue: string;
  unit?: string;
  sourceQuote: string | null;
  onSave: (value: string) => void;
  onClose: () => void;
}

export function EditFieldDialog({
  open,
  fieldId,
  fieldLabel,
  modelValue,
  currentValue,
  unit,
  sourceQuote,
  onSave,
  onClose,
}: EditFieldDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(currentValue);
  const inputId = `edit-field-value-${fieldId}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setValue(currentValue);
      dialog.showModal();
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, currentValue]);

  return (
    <dialog
      ref={dialogRef}
      className="edit-field-dialog"
      onClose={onClose}
      onCancel={onClose}
    >
      <form
        className="edit-field-dialog__form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
        }}
      >
        <h3 className="edit-field-dialog__title">Edit {fieldLabel}</h3>
        <p className="edit-field-dialog__original">
          Model extracted: <strong>{modelValue || '(empty)'}{unit ? ` ${unit}` : ''}</strong>
        </p>
        {sourceQuote ? (
          <blockquote className="edit-field-dialog__quote">{sourceQuote}</blockquote>
        ) : null}
        <label className="edit-field-dialog__label" htmlFor={inputId}>
          Corrected value
        </label>
        <input
          id={inputId}
          ref={inputRef}
          className="edit-field-dialog__input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="edit-field-dialog__actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save correction
          </Button>
        </div>
      </form>
    </dialog>
  );
}
