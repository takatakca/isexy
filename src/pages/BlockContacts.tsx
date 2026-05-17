import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Search, Plus, MoreVertical, UserX } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export default function BlockContacts() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"contacts" | "blocked">("contacts");
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [blockedContacts, setBlockedContacts] = useState<Contact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  
  // Add contact form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const handleImportContacts = () => {
    // In a real app, this would use the Contacts API
    alert("Contact import would be triggered here. This requires native device integration.");
  };

  const handleBlockContact = (contact: Contact) => {
    setContacts(contacts.filter(c => c.id !== contact.id));
    setBlockedContacts([...blockedContacts, contact]);
  };

  const handleUnblockContact = (contact: Contact) => {
    setBlockedContacts(blockedContacts.filter(c => c.id !== contact.id));
    setContacts([...contacts, contact]);
  };

  const handleAddContact = () => {
    if (!newName.trim()) return;
    
    const newContact: Contact = {
      id: Date.now().toString(),
      name: newName,
      phone: newPhone || undefined,
      email: newEmail || undefined,
    };
    
    setContacts([...contacts, newContact]);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setShowAddContact(false);
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBlocked = blockedContacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (showAddContact) {
    return (
      <AuthLayout showBack variant="white">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Add Contact</h1>
          <button
            onClick={handleAddContact}
            className="text-primary font-semibold"
          >
            Done
          </button>
        </div>

        <div className="space-y-1">
          <div className="bg-muted/30 p-4">
            <label className="text-sm font-bold text-foreground block mb-2">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter name"
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          <div className="bg-muted/30 p-4">
            <label className="text-sm font-bold text-foreground block mb-4">Contact Info</label>
            <div className="space-y-4">
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Add phone number"
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Add email"
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showBack variant="white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Block Contacts</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddContact(true)}
            className="p-2"
          >
            <Plus className="w-6 h-6 text-foreground" />
          </button>
          <button className="p-2">
            <MoreVertical className="w-6 h-6 text-foreground" />
          </button>
        </div>
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
          Contacts
        </button>
        <button
          onClick={() => setActiveTab("blocked")}
          className={`flex-1 py-3 font-semibold text-center border-b-2 transition-colors ${
            activeTab === "blocked"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Blocked
        </button>
      </div>

      {/* Search */}
      <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-3 mb-6">
        <Search className="w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a name or number"
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      {/* Content */}
      {activeTab === "contacts" ? (
        <div className="flex-1">
          {filteredContacts.length > 0 ? (
            <div className="space-y-2">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-4 bg-card rounded-xl"
                >
                  <div>
                    <p className="font-semibold text-foreground">{contact.name}</p>
                    {contact.phone && (
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleBlockContact(contact)}
                    className="px-4 py-2 bg-destructive text-white rounded-full text-sm font-semibold"
                  >
                    Block
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <button
                onClick={handleImportContacts}
                className="px-8 py-3 bg-background text-background rounded-full font-semibold"
              >
                Import Contacts
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1">
          {filteredBlocked.length > 0 ? (
            <div className="space-y-2">
              {filteredBlocked.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-4 bg-card rounded-xl"
                >
                  <div>
                    <p className="font-semibold text-foreground">{contact.name}</p>
                    {contact.phone && (
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleUnblockContact(contact)}
                    className="px-4 py-2 bg-primary text-white rounded-full text-sm font-semibold"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <UserX className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">No Blocked Contacts</h2>
              <p className="text-muted-foreground max-w-xs">
                Block people by using the Contacts tab to select anyone you don't want to see.
              </p>
            </div>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
