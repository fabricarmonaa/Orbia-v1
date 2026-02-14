import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SettingsSection {
  id: string;
  label: string;
  content: React.ReactNode;
}

export function SettingsLayout({ sections }: { sections: SettingsSection[] }) {
  if (!sections.length) return null;
  const defaultValue = sections[0].id;

  return (
    <Tabs defaultValue={defaultValue} className="flex flex-col lg:flex-row gap-6">
      <TabsList className="flex lg:flex-col h-auto w-full lg:w-56 lg:sticky lg:top-4 lg:self-start bg-transparent p-0 gap-2">
        {sections.map((section) => (
          <TabsTrigger
            key={section.id}
            value={section.id}
            className="justify-start w-full"
            data-testid={`tab-${section.id}`}
          >
            {section.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="flex-1 space-y-6">
        {sections.map((section) => (
          <TabsContent key={section.id} value={section.id} className="mt-0 space-y-6">
            {section.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
