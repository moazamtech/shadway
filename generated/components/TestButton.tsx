import { Button } from "@/components/ui/button";
import { SparklesIcon } from "lucide-react";

export default function TestButton() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-2xl font-bold text-gray-900">Test Button Component</h2>
      <p className="text-gray-600 text-center max-w-md">
        This is a test component to verify the dynamic preview system is working correctly.
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        <Button variant="default" className="gap-2">
          <SparklesIcon className="h-4 w-4" />
          Default Button
        </Button>
        <Button variant="secondary">Secondary Button</Button>
        <Button variant="outline">Outline Button</Button>
        <Button variant="destructive">Destructive Button</Button>
        <Button variant="ghost">Ghost Button</Button>
      </div>
    </div>
  );
}
