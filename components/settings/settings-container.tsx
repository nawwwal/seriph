"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/settings/general-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { StorageSettings } from "@/components/settings/storage-settings";
import { FontSettings } from "@/components/settings/font-settings";

export function SettingsContainer() {
  return (
    <Tabs defaultValue="general" className="max-w-4xl mx-auto">
      <TabsList className="grid grid-cols-4 mb-8">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="appearance">Appearance</TabsTrigger>
        <TabsTrigger value="fonts">Font Display</TabsTrigger>
        <TabsTrigger value="storage">Storage</TabsTrigger>
      </TabsList>
      
      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Manage basic application settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettings />
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="appearance">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize the look and feel of Typeface Vault.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AppearanceSettings />
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="fonts">
        <Card>
          <CardHeader>
            <CardTitle>Font Display</CardTitle>
            <CardDescription>
              Configure how fonts are displayed and previewed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FontSettings />
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="storage">
        <Card>
          <CardHeader>
            <CardTitle>Storage Management</CardTitle>
            <CardDescription>
              Manage your font storage and usage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StorageSettings />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}