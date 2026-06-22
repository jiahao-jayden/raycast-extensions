// src/save.tsx
import { showToast, Toast } from "@raycast/api";
import { SecretForm } from "./components/secret-form";
import { store } from "./storage";

export default function SaveCommand() {
  return (
    <SecretForm
      submitTitle="Save Secret"
      onSubmit={async (values) => {
        const secret = await store.save(values);
        await showToast({
          style: Toast.Style.Success,
          title: "Secret saved",
          message: secret.title,
        });
      }}
    />
  );
}
