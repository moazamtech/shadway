import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

interface AdminHeaderProps {
  userName?: string;
}

export function AdminHeader({ userName }: AdminHeaderProps) {
  const handleSignOut = () => {
    signOut();
  };

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage your component library websites and monitor performance
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right">
              <span className="text-sm text-muted-foreground">Welcome back,</span>
              <div className="font-medium">{userName}</div>
            </div>

            <ThemeToggle />

            <Button
              variant="outline"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}