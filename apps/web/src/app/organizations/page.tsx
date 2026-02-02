"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlusCircle,
  Search,
  Trash2,
  Building2,
  Edit2,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import {
  Button,
  Card,
  Badge,
  Input,
  ConfirmDialog,
  SkeletonCard,
  useToast,
} from "@/components/ui";
import {
  organizationApi,
  type OrganizationWithCount,
  type CreateOrganizationInput,
} from "@/lib/api";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";
import { useEffect, useState as useReactState } from "react";

export default function OrganizationsPage() {
  const {
    organizations,
    refetch,
    loading: contextLoading,
    isAdmin,
  } = useOrganization();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string;
    name: string;
  }>({
    open: false,
    id: "",
    name: "",
  });
  const [deleting, setDeleting] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState<CreateOrganizationInput>({
    name: "",
    slug: "",
    description: "",
  });

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setCreateForm({ ...createForm, name, slug });
  };

  // Filter organizations by search
  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.slug) return;

    setCreateLoading(true);
    try {
      await organizationApi.create(createForm);
      toast({
        title: "Organization created",
        description: `${createForm.name} has been created successfully.`,
        variant: "success",
      });
      setShowCreateModal(false);
      setCreateForm({ name: "", slug: "", description: "" });
      refetch();
    } catch (error) {
      toast({
        title: "Failed to create organization",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "error",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await organizationApi.delete(deleteDialog.id);
      toast({
        title: "Organization deleted",
        description: `${deleteDialog.name} has been removed.`,
        variant: "success",
      });
      setDeleteDialog({ open: false, id: "", name: "" });
      refetch();
    } catch (error) {
      toast({
        title: "Failed to delete organization",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageContainer
      title="Organizations"
      description="Manage client organizations and their cluster environments."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Organizations" },
      ]}
      actions={
        isAdmin ? (
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusCircle size={18} />
            <span className="hidden sm:inline">New Organization</span>
          </Button>
        ) : undefined
      }
    >
      {/* Search */}
      <Card className="p-4 flex items-center gap-3">
        <Search className="text-muted-foreground" size={20} />
        <input
          type="text"
          placeholder="Search organizations by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none flex-1 text-sm text-foreground placeholder:text-muted-foreground"
        />
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
            Clear
          </Button>
        )}
      </Card>

      {/* Organization List */}
      <div className="space-y-4">
        {contextLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredOrgs.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">
              {organizations.length === 0
                ? "No organizations found"
                : "No matching organizations"}
            </h3>
            <p className="text-muted-foreground mt-1">
              {organizations.length === 0
                ? "Create your first organization to manage client clusters."
                : "Try adjusting your search terms."}
            </p>
            {organizations.length === 0 && isAdmin && (
              <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                Create Organization
              </Button>
            )}
          </Card>
        ) : (
          filteredOrgs.map((org, index) => (
            <motion.div
              key={org.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card hover className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {org.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{org.name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="secondary" size="sm">
                          {org.slug}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {org.cluster_count} cluster
                          {org.cluster_count !== 1 ? "s" : ""}
                        </span>
                        {org.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            • {org.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                        org.is_active
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-red-500/10 text-red-500",
                      )}
                    >
                      {org.is_active ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                      <span>{org.is_active ? "Active" : "Inactive"}</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDeleteDialog({
                          open: true,
                          id: org.id,
                          name: org.name,
                        })
                      }
                      className="text-muted-foreground hover:text-red-500"
                      disabled={
                        org.id === "00000000-0000-0000-0000-000000000000"
                      }
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Organization Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="w-full max-w-md p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold">Create Organization</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add a new client organization to manage their clusters
                    separately.
                  </p>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                  <Input
                    label="Organization Name"
                    placeholder="e.g., Acme Corporation"
                    required
                    value={createForm.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />

                  <div className="space-y-1.5">
                    <Input
                      label="Slug"
                      placeholder="e.g., acme-corp"
                      required
                      value={createForm.slug}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          slug: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      URL-friendly identifier (lowercase, hyphens only)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Description (Optional)
                    </label>
                    <textarea
                      placeholder="Brief description of this organization..."
                      value={createForm.description || ""}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" loading={createLoading}>
                      Create Organization
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: "", name: "" })}
        onConfirm={handleDelete}
        title="Delete Organization"
        description={`Are you sure you want to delete "${deleteDialog.name}"? This action cannot be undone. Make sure all clusters are removed first.`}
        confirmText="Delete Organization"
        variant="destructive"
        loading={deleting}
      />
    </PageContainer>
  );
}
