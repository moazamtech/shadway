import { useState } from "react";
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
import { Loader2, Code } from "lucide-react";
import { Template, TemplateFormData } from "@/lib/types";
import { fetchSiteMetadata } from "@/lib/metadata-fetcher";

interface TemplateFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TemplateFormData) => Promise<void>;
  template?: Template | null;
  isLoading?: boolean;
}

/**
 * Rows written before the price was flattened still carry `{ amount }`.
 */
type LegacyTemplate = Omit<Template, "price"> & {
  price?: number | { amount?: number };
};

type TemplateFormState = {
  name: string;
  description: string;
  image: string;
  demoUrl: string;
  purchaseUrl: string;
  price: number;
  featured: boolean;
  sequence: number;
};

/** The form with nothing in it, which is what a new template starts from. */
const EMPTY_TEMPLATE_FORM: TemplateFormState = {
  name: "",
  description: "",
  image: "",
  demoUrl: "",
  purchaseUrl: "",
  price: 0,
  featured: false,
  sequence: 0,
};

/**
 * The form as the template describes it.
 *
 * The price comes through the legacy shape as well, because a row written
 * before the price was flattened still carries the amount inside an object.
 */
function templateFormOf(template: Template): TemplateFormState {
  const legacy = template as LegacyTemplate;
  return {
    name: template.name || "",
    description: template.description || "",
    image: template.image || "",
    demoUrl: template.demoUrl || "",
    purchaseUrl: template.purchaseUrl || "",
    price:
      typeof legacy.price === "object"
        ? (legacy.price.amount as number)
        : legacy.price || 0,
    featured: template.featured || false,
    sequence: template.sequence || 0,
  };
}

export function TemplateFormDialog({
  isOpen,
  onClose,
  onSubmit,
  template,
  isLoading = false,
}: TemplateFormDialogProps) {
  const [formData, setFormData] = useState<TemplateFormState>(() =>
    template ? templateFormOf(template) : EMPTY_TEMPLATE_FORM,
  );
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  /**
   * The form belongs to the template it was opened for.
   *
   * A dialog that edits one template and then edits another would keep the
   * first one's values unless something cleared them, and the clearing
   * landed a render late. React compares a value with the one from the
   * previous render, so the previous template is what has to be kept, and
   * the form is emptied in the render that notices the change.
   */
  const [syncedTemplate, setSyncedTemplate] = useState(template);
  const [syncedOpen, setSyncedOpen] = useState(isOpen);
  if (syncedTemplate !== template || syncedOpen !== isOpen) {
    setSyncedTemplate(template);
    setSyncedOpen(isOpen);
    setFormData(template ? templateFormOf(template) : EMPTY_TEMPLATE_FORM);
  }

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
    setFormData(EMPTY_TEMPLATE_FORM);
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
            
            {/* Image Preview */}
            <div className="mt-2">
              {formData.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={formData.image}
                  alt="Template preview"
                  className="w-full h-auto object-cover rounded border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://via.placeholder.com/300x160?text=Invalid+Image";
                  }}
                />
              ) : (
                <div className="w-full h-auto flex items-center justify-center rounded border bg-gray-100 text-gray-500 text-sm">
                  No preview available
                </div>
              )}
            </div>
          </div>

          {/* Purchase Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              {/* <DollarSign className="w-4 h-4" /> */}
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