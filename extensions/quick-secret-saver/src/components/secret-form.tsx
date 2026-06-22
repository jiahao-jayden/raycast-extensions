// src/components/secret-form.tsx
import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";

export interface SecretFormValues {
  title: string;
  content: string;
}

interface SecretFormProps {
  /** Pre-filled values (edit mode or clipboard prefill). */
  initialValues?: Partial<SecretFormValues>;
  /** Text on the submit button. */
  submitTitle: string;
  /** Called with validated values. Should persist and handle its own errors. */
  onSubmit: (values: SecretFormValues) => Promise<void>;
}

export function SecretForm({
  initialValues,
  submitTitle,
  onSubmit,
}: SecretFormProps) {
  const { pop } = useNavigation();
  const [titleError, setTitleError] = useState<string | undefined>();

  async function handleSubmit(values: SecretFormValues) {
    if (!values.title.trim()) {
      setTitleError("Title is required");
      return;
    }
    try {
      await onSubmit({ title: values.title.trim(), content: values.content });
      pop();
    } catch (error) {
      // Never echo content; reference the title only (spec §9).
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save secret",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title={submitTitle} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        placeholder="e.g. Work email password"
        defaultValue={initialValues?.title}
        error={titleError}
        onChange={() => titleError && setTitleError(undefined)}
      />
      <Form.TextArea
        id="content"
        title="Content"
        placeholder="The secret text to store"
        defaultValue={initialValues?.content}
      />
    </Form>
  );
}
