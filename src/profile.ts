import { ico } from "./icons";
import type { DidAccount, DidProfile } from "./did";
import { el, toast, modal, confirmDialog, promptDialog } from "./ui";
import { t } from "./i18n";
import { escapeHtml } from "./render";

export interface ContactExchange {
  did: string;
  alias: string;
  color: string;
  bio: string;
  models?: string[];
  interests?: string[];
  exchangedAt: number;
}

export class ProfileView {
  private host: HTMLElement;
  private contacts: ContactExchange[] = [];

  constructor(
    private did: DidAccount,
    container: HTMLElement,
    private onExchangeContact?: (c: ContactExchange) => void
  ) {
    this.host = el("div", "profile-view");
    container.appendChild(this.host);
    this.loadContacts();
    this.render();
  }

  private async loadContacts(): Promise<void> {
    try {
      const saved = localStorage.getItem("shai-contacts");
      if (saved) this.contacts = JSON.parse(saved);
    } catch { /* ignore */ }
  }

  private saveContacts(): void {
    try {
      localStorage.setItem("shai-contacts", JSON.stringify(this.contacts));
    } catch { /* ignore */ }
  }

  render(): void {
    const profile = this.did.profile;
    const doc = this.did.document();
    
    this.host.innerHTML = `
      <div class="profile-container">
        <div class="profile-card">
          <div class="profile-header">
            <div class="profile-avatar" style="background: ${profile?.color || '#7d79f6'}">${profile?.alias.charAt(0).toUpperCase() || '?'}</div>
            <div class="profile-info">
              <h2>${escapeHtml(profile?.alias || t('No identity'))}</h2>
              <p class="profile-did">${profile?.did ? `${profile.did.slice(0, 24)}...${profile.did.slice(-8)}` : ''}</p>
              ${profile?.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
            </div>
          </div>
          
          ${!profile ? `
            <div class="no-identity">
              <p>${t('Create your decentralized identity to start exchanging contacts')}</p>
              <button class="btn btn-primary" id="create-identity">${ico("shield")} ${t('Create Identity')}</button>
            </div>
          ` : `
            <div class="profile-actions">
              <button class="btn btn-ghost" id="edit-profile">${ico("edit")} ${t('Edit Profile')}</button>
              <button class="btn btn-ghost" id="export-did">${ico("download")} ${t('Export DID')}</button>
              <button class="btn btn-ghost danger-text" id="erase-identity">${ico("trash")} ${t('Erase Identity')}</button>
            </div>
            
            <div class="profile-details">
              <h3>${t('Identity Details')}</h3>
              <div class="detail-row">
                <span class="detail-label">${t('DID')}</span>
                <code class="detail-value">${escapeHtml(profile.did)}</code>
              </div>
              <div class="detail-row">
                <span class="detail-label">${t('Created')}</span>
                <span class="detail-value">${new Date(profile.createdAt).toLocaleString()}</span>
              </div>
              ${doc?.verificationMethod?.[0] ? `
                <div class="detail-row">
                  <span class="detail-label">${t('Public Key Type')}</span>
                  <span class="detail-value">${doc.verificationMethod[0].type}</span>
                </div>
              ` : ''}
            </div>
          `}
          
          <div class="contacts-section">
            <h3>${t('Exchanged Contacts')} <span class="contact-count">${this.contacts.length}</span></h3>
            ${this.contacts.length === 0 ? `
              <div class="contacts-empty">${ico("users")} ${t('No contacts yet — meet people in the mesh network')}</div>
            ` : `
              <div class="contacts-list">
                ${this.contacts.map(c => `
                  <div class="contact-item" style="border-left-color: ${c.color}">
                    <div class="contact-avatar" style="background: ${c.color}">${c.alias.charAt(0).toUpperCase()}</div>
                    <div class="contact-info">
                      <div class="contact-name">${escapeHtml(c.alias)}</div>
                      <div class="contact-did">${c.did.slice(0, 20)}...</div>
                      ${c.bio ? `<div class="contact-bio">${escapeHtml(c.bio)}</div>` : ''}
                      <div class="contact-time">${new Date(c.exchangedAt).toLocaleString()}</div>
                    </div>
                    <button class="icon-btn contact-copy" data-did="${escapeHtml(c.did)}" title="${t('Copy DID')}">${ico("copy")}</button>
                    <button class="icon-btn contact-del" data-idx="${this.contacts.indexOf(c)}" title="${t('Remove')}">${ico("trash")}</button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const createBtn = this.host.querySelector("#create-identity");
    if (createBtn) {
      createBtn.addEventListener("click", () => this.createIdentity());
    }

    const editBtn = this.host.querySelector("#edit-profile");
    if (editBtn) {
      editBtn.addEventListener("click", () => this.editProfile());
    }

    const exportBtn = this.host.querySelector("#export-did");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportDid());
    }

    const eraseBtn = this.host.querySelector("#erase-identity");
    if (eraseBtn) {
      eraseBtn.addEventListener("click", () => this.eraseIdentity());
    }

    this.host.querySelectorAll(".contact-copy").forEach(btn => {
      btn.addEventListener("click", async () => {
        const did = (btn as HTMLElement).getAttribute("data-did") || "";
        await navigator.clipboard.writeText(did);
        toast(t("DID copied to clipboard"), "ok");
      });
    });

    this.host.querySelectorAll(".contact-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt((btn as HTMLElement).getAttribute("data-idx") || "-1");
        if (idx >= 0) {
          this.contacts.splice(idx, 1);
          this.saveContacts();
          this.render();
          toast(t("Contact removed"), "ok");
        }
      });
    });
  }

  private async createIdentity(): Promise<void> {
    const alias = await promptDialog({
      title: t("Create Your Identity"),
      label: t("Choose an alias"),
      placeholder: t("e.g., Alice, Node42, CryptoDev..."),
    });

    if (!alias || !alias.trim()) return;

    try {
      const profile = await this.did.create(alias.trim());
      toast(`${t("Identity created!")} ${profile.did.slice(0, 24)}...`, "ok");
      this.render();
    } catch (e: any) {
      toast(e?.message || t("Failed to create identity"), "err");
    }
  }

  private async editProfile(): Promise<void> {
    const profile = this.did.profile;
    if (!profile) return;

    const newAlias = await promptDialog({
      title: t("Edit Alias"),
      label: t("Alias"),
      value: profile.alias,
    });

    if (newAlias && newAlias.trim()) {
      await this.did.updateProfile({ alias: newAlias.trim() });
      
      const newBio = await promptDialog({
        title: t("Edit Bio"),
        label: t("Bio (optional)"),
        value: profile.bio,
        placeholder: t("Tell us about yourself..."),
      });
      
      await this.did.updateProfile({ bio: newBio?.trim() || "" });
      
      // Color picker simulation
      const colors = ["#7d79f6", "#2db59e", "#f16a6e", "#f0b429", "#3ecf8e"];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      await this.did.updateProfile({ color: randomColor });
      
      toast(t("Profile updated"), "ok");
      this.render();
    }
  }

  private exportDid(): void {
    const doc = this.did.document();
    if (!doc) return;

    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.did.profile?.alias || "did"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(t("DID document exported"), "ok");
  }

  private async eraseIdentity(): Promise<void> {
    const ok = await confirmDialog({
      title: t("Erase Identity?"),
      text: t("This will permanently delete your DID and profile. This cannot be undone."),
      okText: t("Erase"),
      danger: true,
    });

    if (ok) {
      await this.did.erase();
      toast(t("Identity erased"), "ok");
      this.render();
    }
  }

  exchangeContact(contact: ContactExchange): void {
    // Avoid duplicates
    const exists = this.contacts.some(c => c.did === contact.did);
    if (!exists) {
      this.contacts.unshift(contact);
      this.saveContacts();
      this.onExchangeContact?.(contact);
      toast(`${t("Contact exchanged with")} ${contact.alias}`, "ok");
      this.render();
    }
  }

  destroy(): void {
    this.host.remove();
  }
}
