import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, DollarSign, Globe, Code } from "lucide-react";
import { Template } from "@/lib/types";
import { fetchSiteMetadata } from "@/lib/metadata-fetcher";

interface TemplateFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  template?: Template | null;
  isLoading?: boolean;
}

export function TemplateFormDialog({
  isOpen,
  onClose,
  onSubmit,
  template,
  isLoading = false,
}: TemplateFormDialogProps) {
  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    image: template?.image || "",
    demoUrl: template?.demoUrl || "",
    purchaseUrl: template?.purchaseUrl || "",
    price: template?.price || 0,
    featured: template?.featured || false,
    sequence: template?.sequence || 0,
  });
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || "",
        description: template.description || "",
        image: template.image || "",
        demoUrl: template.demoUrl || "",
        purchaseUrl: template.purchaseUrl || "",
        price:
          typeof template.price === "object"
            ? (template.price as any).amount
            : template.price || 0,
        featured: template.featured || false,
        sequence: template.sequence || 0,
      });
    } else {
      // reset for "create new"
      setFormData({
        name: "",
        description: "",
        image: "",
        demoUrl: "",
        purchaseUrl: "",
        price: 0,
        featured: false,
        sequence: 0,
      });
    }
  }, [template, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleFetchMetadata = async () => {
    if (!formData.demoUrl) {
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const metadata = await fetchSiteMetadata(formData.demoUrl);
      setFormData((prev) => ({
        ...prev,
        name: metadata.title || prev.name,
        description: metadata.description || prev.description,
        image: metadata.ogImage || prev.image,
      }));
    } catch (error) {
      console.error("Failed to fetch metadata:", error);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      image: "",
      demoUrl: "",
      purchaseUrl: "",
      price: 0,
      featured: false,
      sequence: 0,
    });
  };

  const handleClose = () => {
    if (!template) resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Code className="w-5 h-5" />
            {template ? "Edit Template" : "Add New Template"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? "Update the template information below."
              : "Fill in the demo URL and let us auto-fetch the details, then add pricing and purchase link."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Demo URL with Auto-fetch */}
          <div className="space-y-2">
            <Label htmlFor="demoUrl">Demo URL</Label>
            <div className="flex gap-2">
              <Input
                id="demoUrl"
                type="url"
                value={formData.demoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, demoUrl: e.target.value })
                }
                placeholder="https://template-demo.com"
                className="flex-1"
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchMetadata}
                disabled={isFetchingMetadata || !formData.demoUrl}
                className="shrink-0"
              >
                {isFetchingMetadata ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Auto-fetch"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the demo URL first, then click Auto-fetch to fill title,
              description, and image
            </p>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter template name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe the template..."
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Preview Image URL</Label>
              <Input
                id="image"
                type="url"
                value={formData.image}
                onChange={(e) =>
                  setFormData({ ...formData, image: e.target.value })
                }
                placeholder="https://example.com/preview-image.jpg"
                required
              />
            </div>
          </div>

          {/* Purchase Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Purchase Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0 for free templates"
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 for free templates
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sequence">Display Order</Label>
                <Input
                  id="sequence"
                  type="number"
                  min="0"
                  value={formData.sequence}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sequence: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseUrl">Purchase/Download URL</Label>
              <Input
                id="purchaseUrl"
                type="url"
                value={formData.purchaseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, purchaseUrl: e.target.value })
                }
                placeholder="https://where-to-buy-template.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                This is where users will be redirected to purchase/download the
                template
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="featured"
                checked={formData.featured}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, featured: checked })
                }
              />
              <Label htmlFor="featured" className="text-sm font-medium">
                Mark as featured template
              </Label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {template ? "Updating..." : "Creating..."}
                </>
              ) : template ? (
                "Update Template"
              ) : (
                "Create Template"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
