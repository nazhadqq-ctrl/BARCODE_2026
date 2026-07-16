import { useEffect } from "react";
import { useLocation } from "wouter";

export function AdminSetupPage() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/admin");
  }, []);
  return null;
}
