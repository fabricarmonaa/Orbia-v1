import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { AuthUser } from "@/lib/auth";

export function AccountSettings({ user }: { user: AuthUser | null }) {
  if (!user) return null;
  const initials = user.fullName
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "U";

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Perfil de usuario</h3>
        <p className="text-sm text-muted-foreground">Información básica de tu cuenta</p>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{user.fullName}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground mt-1">Rol: {user.role}</p>
        </div>
      </CardContent>
    </Card>
  );
}
