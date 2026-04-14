"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type PolicyType = "privacy" | "terms" | null;

interface LegalContextValue {
  vaultOpen: PolicyType;
  openVault: (type: "privacy" | "terms") => void;
  closeVault: () => void;
}

const LegalContext = createContext<LegalContextValue>({
  vaultOpen: null,
  openVault: () => {},
  closeVault: () => {},
});

export function LegalProvider({ children }: { children: React.ReactNode }) {
  const [vaultOpen, setVaultOpen] = useState<PolicyType>(null);

  const openVault = useCallback((type: "privacy" | "terms") => {
    setVaultOpen(type);
    document.documentElement.setAttribute("data-vault", "open");
  }, []);

  const closeVault = useCallback(() => {
    setVaultOpen(null);
    document.documentElement.removeAttribute("data-vault");
  }, []);

  return (
    <LegalContext.Provider value={{ vaultOpen, openVault, closeVault }}>
      {children}
    </LegalContext.Provider>
  );
}

export const useLegal = () => useContext(LegalContext);
