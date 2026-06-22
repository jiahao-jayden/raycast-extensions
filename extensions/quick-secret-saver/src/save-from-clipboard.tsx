// src/save-from-clipboard.tsx
import { Clipboard, showToast, Toast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { SecretForm } from "./components/secret-form";
import { store } from "./storage";

export default function SaveFromClipboardCommand() {
  // Read the clipboard on mount via usePromise (not a hand-rolled useEffect).
  // isLoading gates the form mount so it gets the right default content.
  const { isLoading, data: clipboard } = usePromise(async () => {
    const text = await Clipboard.readText();
    if (!text) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Clipboard is empty",
        message: "Type the content manually.",
      });
    }
    return text ?? "";
  });

  // Wait for the clipboard read so the form mounts with the right default.
  if (isLoading) {
    return null;
  }

  return (
    <SecretForm
      // Re-key on the resolved content so the prefilled default applies.
      key={clipboard ?? "empty"}
      submitTitle="Save Secret"
      initialValues={{ content: clipboard ?? "" }}
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
