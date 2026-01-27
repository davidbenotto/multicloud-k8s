"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, ChevronDown, Shield, Check } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";

export function OrgSelector() {
  const {
    organizations,
    currentOrg,
    isAdmin,
    setCurrentOrg,
    setAdminMode,
    loading,
  } = useOrganization();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <div className="h-9 w-40 rounded-lg bg-muted/50 animate-pulse" />;
  }

  const displayName = isAdmin
    ? "All Organizations"
    : currentOrg?.name || "Select Organization";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors min-w-[200px]",
          open && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        <div
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold",
            isAdmin
              ? "bg-amber-500/20 text-amber-500"
              : "bg-primary/10 text-primary",
          )}
        >
          {isAdmin ? <Shield size={14} /> : <Building2 size={14} />}
        </div>
        <span className="text-sm font-medium truncate flex-1 text-left">
          {displayName}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-2 w-64 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden"
            >
              <div className="p-2">
                {/* Admin Mode Option */}
                <button
                  onClick={() => {
                    setAdminMode(true);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    isAdmin ? "bg-amber-500/10" : "hover:bg-muted/50",
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center">
                    <Shield size={16} />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      All Organizations
                    </span>
                    <p className="text-xs text-muted-foreground">Admin view</p>
                  </div>
                  {isAdmin && <Check size={16} className="text-amber-500" />}
                </button>

                {organizations.length > 0 && (
                  <div className="my-2 border-t border-border" />
                )}

                {/* Organization List */}
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setCurrentOrg(org);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                        currentOrg?.id === org.id && !isAdmin
                          ? "bg-primary/10"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                          currentOrg?.id === org.id && !isAdmin
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {org.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {org.name}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {org.cluster_count} cluster
                          {org.cluster_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {currentOrg?.id === org.id && !isAdmin && (
                        <Check size={16} className="text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
