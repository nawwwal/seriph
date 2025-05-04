import { SettingsContainer } from "@/components/settings/settings-container";

export default function SettingsPage() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Customize your Typeface Vault experience.
        </p>
      </div>
      
      <SettingsContainer />
    </div>
  );
}