import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-black text-foreground mb-2">404</h1>
      <p className="text-muted-foreground mb-8">Page not found</p>
      <Button onClick={() => navigate("/")}>Go Home</Button>
    </div>
  );
}
