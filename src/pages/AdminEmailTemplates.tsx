import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Mail, Save, RefreshCw, Edit2, Eye, Code, 
  AlertCircle, CheckCircle, Ticket, Tag, BarChart3
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  description: string | null;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AdminEmailTemplates = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedIsActive, setEditedIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"code" | "preview">("code");
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchTemplates();
    }
  }, [isAdmin]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Access denied", description: "Please log in", variant: "destructive" });
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdminRole = roles?.some(r => r.role === "admin");
      
      if (!hasAdminRole) {
        toast({ title: "Access denied", description: "Admin access required", variant: "destructive" });
        navigate("/settings");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/settings");
    }
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast({ title: "Error", description: "Failed to load email templates", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEditedSubject(template.subject);
    setEditedBody(template.body_html);
    setEditedDescription(template.description || "");
    setEditedIsActive(template.is_active);
    setPreviewMode("code");
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({
          subject: editedSubject,
          body_html: editedBody,
          description: editedDescription,
          is_active: editedIsActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTemplate.id);

      if (error) throw error;

      toast({ title: "Template saved", description: `${selectedTemplate.name} has been updated` });
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const getTemplateIcon = (name: string) => {
    switch (name) {
      case "ticket_confirmation": return <Mail className="w-5 h-5" />;
      case "ticket_status_update": return <RefreshCw className="w-5 h-5" />;
      case "ticket_assigned": return <CheckCircle className="w-5 h-5" />;
      default: return <Mail className="w-5 h-5" />;
    }
  };

  const getPreviewHtml = () => {
    let html = editedBody;
    // Replace variables with sample data for preview
    const sampleData: Record<string, string> = {
      name: "John Doe",
      ticket_number: "TKT-ABC123",
      subject: "Sample Support Request",
      category: "Technical Issue",
      priority: "High",
      status: "In Progress",
      response: "Thank you for contacting us. We are looking into this issue.",
      assignee_name: "Support Agent",
    };

    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, "g"), value);
    });

    // Handle conditional blocks
    html = html.replace(/{{#if response}}([\s\S]*?){{\/if}}/g, "$1");

    return html;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link to="/admin/tickets" className="p-2 hover:bg-muted rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Link>
            <h1 className="text-xl font-bold text-foreground">Email Templates</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/dashboard')}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/tickets')}>
              <Ticket className="w-4 h-4 mr-2" />
              Tickets
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchTemplates} disabled={isLoading}>
              <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Manage Email Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-4">
              Customize the automated emails sent to users. Use {"{{variable}}"} syntax to insert dynamic content.
            </p>

            <div className="space-y-3">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="p-4 bg-muted/50 rounded-lg animate-pulse">
                    <div className="h-5 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                  </div>
                ))
              ) : templates.length > 0 ? (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 bg-muted/30 rounded-lg border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => handleEditTemplate(template)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          {getTemplateIcon(template.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground capitalize">
                              {template.name.replace(/_/g, " ")}
                            </h3>
                            <Badge variant={template.is_active ? "default" : "secondary"}>
                              {template.is_active ? "Active" : "Disabled"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">Variables:</span>
                            {template.variables.map((v) => (
                              <Badge key={v} variant="outline" className="text-xs">
                                {`{{${v}}}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No email templates found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Template Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Edit: {selectedTemplate?.name.replace(/_/g, " ")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="template-active" className="flex items-center gap-2">
                Template Active
              </Label>
              <Switch
                id="template-active"
                checked={editedIsActive}
                onCheckedChange={setEditedIsActive}
              />
            </div>

            <div>
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Template description..."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="template-subject">Email Subject</Label>
              <Input
                id="template-subject"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                placeholder="Email subject line..."
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Email Body (HTML)</Label>
                <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as "code" | "preview")}>
                  <TabsList className="h-8">
                    <TabsTrigger value="code" className="text-xs px-3">
                      <Code className="w-3 h-3 mr-1" />
                      Code
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs px-3">
                      <Eye className="w-3 h-3 mr-1" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {previewMode === "code" ? (
                <Textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  placeholder="HTML email body..."
                  className="min-h-[300px] font-mono text-sm"
                />
              ) : (
                <div 
                  className="min-h-[300px] border rounded-lg p-4 bg-white text-black overflow-auto"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                />
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Available Variables:
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedTemplate?.variables.map((v) => (
                  <Badge key={v} variant="outline" className="text-xs cursor-pointer hover:bg-primary/10"
                    onClick={() => {
                      setEditedBody(prev => prev + `{{${v}}}`);
                    }}
                  >
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailTemplates;
