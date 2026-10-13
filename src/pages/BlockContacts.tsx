import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Search, Plus, UserX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemberSettings, type MemberSettings } from "@/hooks/useMemberSettings";

type Contact = NonNullable<MemberSettings["blockedContacts"]>[number];

interface BlockedMember {
  blockId: string;
  profileId: string;
  name: string;
}

const emailSchema = z.string().trim().email("Enter a valid email address");
const phoneSchema = z.string().regex(/^\+?\d{7,15}$/, "Enter a phone number with its country code");

/**
 * Two lists: phone/email contacts the member keeps private (member settings),
 * and ISEXY members they blocked from a profile or chat (isexy.blocks).
 */
export default function BlockContacts() {
  const { profile } = useAuth();
  const { settings, loading: settingsLoading, save } = useMemberSettings();
  const [activeTab, setActiveTab] = useState<"contacts" | "members">("contacts");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [members, setMembers] = useState<BlockedMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  // Add contact form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [formError, setFormError] = useState("");

  const contacts = settings.blockedContacts ?? [];

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      setMembersLoading(true);
      const { data: blocks, error } = await supabase
        .from("blocks")
        .select("id, blocked_id, created_at")
        .eq("blocker_id", profile.id)
        .order("created_at", { ascending: false });
      if (error) {
        if (!cancelled) {
          toast.error("Couldn't load the members you blocked");
          setMembersLoading(false);
        }
        return;
      }
      const ids = (blocks ?? []).map((b) => b.blocked_id);
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id, first_name").in("id", ids)
        : { data: [] as { id: string; first_name: string }[] };
      if (cancelled) return;
      const names = new Map((people ?? []).map((p) => [p.id, p.first_name]));
      setMembers((blocks ?? []).map((b) => ({
        blockId: b.id,
        profileId: b.blocked_id,
        // Paused or removed accounts are not readable any more.
        name: names.get(b.blocked_id) ?? "ISEXY member",
      })));
      setMembersLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const handleUnblockMember = async (member: BlockedMember) => {
    setUnblocking(member.blockId);
    const { error } = await supabase.from("blocks").delete().eq("id", member.blockId);
    setUnblocking(null);
    if (error) {
      toast.error("Couldn't unblock. Please try again.");
      return;
    }
    setMembers((list) => list.filter((m) => m.blockId !== member.blockId));
    toast.success(`${member.name} is unblocked`);
  };

  const saveContacts = async (next: Contact[], message: string) => {
    const savedOnServer = await save({ blockedContacts: next });
    if (savedOnServer) toast.success(message);
    else toast.warning("Saved on this device only. We'll keep trying to sync it.");
  };

  const handleUnblockContact = (contact: Contact) =>
    saveContacts(contacts.filter((c) => c.id !== contact.id), `${contact.name} removed from your list`);

  const handleAddContact = async () => {
    const name = newName.trim();
    const phone = newPhone.replace(/[\s().-]/g, "");
    const email = newEmail.trim().toLowerCase();
    if (!name) return setFormError("Enter a name");
    if (!phone && !email) return setFormError("Add a phone number or an email");
    if (phone) {
      const parsed = phoneSchema.safeParse(phone);
      if (!parsed.success) return setFormError(parsed.error.errors[0].message);
    }
    if (email) {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) return setFormError(parsed.error.errors[0].message);
    }
    const duplicate = contacts.some((c) => (phone && c.phone === phone) || (email && c.email === email));
    if (duplicate) return setFormError("This contact is already on your list");

    await saveContacts(
      [...contacts, { id: crypto.randomUUID(), name, phone: phone || undefined, email: email || undefined }],
      `${name} added to your list`,
    );
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setFormError("");
    setShowAddContact(false);
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.phone?.includes(query) ||
    c.email?.toLowerCase().includes(query)
  );
  const filteredMembers = members.filter((m) => m.name.toLowerCase().includes(query));

  if (showAddContact) {
    return (
      <AuthLayout showBack onBack={() => { setShowAddContact(false); setFormError(""); }} variant="white">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Add Contact</h1>
          <button
            onClick={handleAddContact}
            disabled={settingsLoading}
            className="text-primary font-semibold disabled:opacity-50"
          >
            Done
          </button>
        </div>

        <div className="space-y-1">
          <div className="bg-muted/30 p-4">
            <label htmlFor="block-name" className="text-sm font-bold text-foreground block mb-2">Name</label>
            <input
              id="block-name"
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setFormError(""); }}
              placeholder="Enter name"
              maxLength={80}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          <div className="bg-muted/30 p-4">
            <p className="text-sm font-bold text-foreground block mb-4">Contact Info</p>
            <div className="space-y-4">
              <input
                type="tel"
                aria-label="Phone number"
                value={newPhone}
                onChange={(e) => { setNewPhone(e.target.value); setFormError(""); }}
                placeholder="Add phone number, e.g. +1 514 555 0123"
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
              />
              <input
                type="email"
                aria-label="Email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setFormError(""); }}
                placeholder="Add email"
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          </div>
        </div>

        {formError && (
          <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {formError}
          </p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Only you can see this list. It is saved to your account.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showBack variant="white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Block Contacts</h1>
        <button
          onClick={() => setShowAddContact(true)}
          className="p-2"
          aria-label="Add a contact"
        >
          <Plus className="w-6 h-6 text-foreground" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        <button
          onClick={() => setActiveTab("contacts")}
          className={`flex-1 py-3 font-semibold text-center border-b-2 transition-colors ${
            activeTab === "contacts"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Contacts{contacts.length > 0 ? ` (${contacts.length})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("members")}
          className={`flex-1 py-3 font-semibold text-center border-b-2 transition-colors ${
            activeTab === "members"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Blocked members{members.length > 0 ? ` (${members.length})` : ""}
        </button>
      </div>

      {/* Search */}
      <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-3 mb-6">
        <Search className="w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          aria-label="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={activeTab === "contacts" ? "Search for a name or number" : "Search for a name"}
          className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      {/* Content */}
      {activeTab === "contacts" ? (
        <div className="flex-1">
          {settingsLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filteredContacts.length > 0 ? (
            <div className="space-y-2">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between gap-3 p-4 bg-card rounded-xl"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{contact.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{contact.phone || contact.email}</p>
                  </div>
                  <button
                    onClick={() => handleUnblockContact(contact)}
                    className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <UserX className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">
                {query ? "No contacts found" : "No blocked contacts"}
              </h2>
              <p className="text-muted-foreground max-w-xs mb-6">
                Add the phone number or email of people you know and would rather not meet on ISEXY. Only you can see this list.
              </p>
              <button
                onClick={() => setShowAddContact(true)}
                className="px-8 py-3 bg-foreground text-background rounded-full font-semibold"
              >
                Add a contact
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1">
          {membersLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filteredMembers.length > 0 ? (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div
                  key={member.blockId}
                  className="flex items-center justify-between gap-3 p-4 bg-card rounded-xl"
                >
                  <p className="font-semibold text-foreground truncate">{member.name}</p>
                  <button
                    onClick={() => handleUnblockMember(member)}
                    disabled={unblocking === member.blockId}
                    className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold disabled:opacity-50"
                  >
                    {unblocking === member.blockId ? "Unblocking..." : "Unblock"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <UserX className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">No Blocked Members</h2>
              <p className="text-muted-foreground max-w-xs">
                Members you block from their profile or a chat appear here. You can unblock them at any time.
              </p>
            </div>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
