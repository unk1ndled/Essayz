import { useState, type FormEvent } from "react";
import { api } from "./api";
import { formatDate } from "./format";
import { Avatar } from "./shared-ui";
import type { Rules, User } from "./types";

interface ProfileScreenProps {
  user: User;
  rules: Rules;
  onLogout: () => void;
  onUserUpdated: (user: User) => void;
}

export function ProfileScreen({ user, rules, onLogout, onUserUpdated }: ProfileScreenProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [invitation, setInvitation] = useState<{ inviteUrl: string; expiresAt: string } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileMessage("");
    try {
      const result = await api.updateProfile(displayName, avatarUrl);
      setDisplayName(result.user.displayName);
      setAvatarUrl(result.user.avatarUrl ?? "");
      onUserUpdated(result.user);
      setProfileMessage("Saved.");
    } catch (cause) {
      setProfileMessage(cause instanceof Error ? cause.message : "Could not update your profile");
    } finally {
      setProfileBusy(false);
    }
  }

  async function useInitials() {
    setProfileBusy(true);
    setProfileMessage("");
    try {
      const result = await api.updateProfile(displayName, "");
      setDisplayName(result.user.displayName);
      setAvatarUrl("");
      onUserUpdated(result.user);
      setProfileMessage("Saved.");
    } catch (cause) {
      setProfileMessage(cause instanceof Error ? cause.message : "Could not remove your profile photo");
    } finally {
      setProfileBusy(false);
    }
  }

  async function generateInvitation() {
    setInviteBusy(true);
    setInviteMessage("");
    try {
      setInvitation(await api.createInvitation());
    } catch (cause) {
      setInviteMessage(cause instanceof Error ? cause.message : "Could not create an invitation");
    } finally {
      setInviteBusy(false);
    }
  }

  async function copyInvitation() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.inviteUrl);
      setInviteMessage("Invitation copied.");
    } catch {
      setInviteMessage("Select the link and copy it manually.");
    }
  }

  return (
    <div className="profile-page">
      <header className="page-header profile-header"><div><p className="eyebrow">Your corner</p><h1>Profile</h1></div></header>
      <div className="profile-sections">
        <section className="profile-card profile-section">
          <div className="profile-avatar-preview">
            <Avatar user={{ ...user, displayName: displayName.trim() || user.displayName, avatarUrl: avatarUrl.trim() || null }} />
            <div><h2>{displayName.trim() || user.displayName}</h2><p>@{user.username}</p></div>
          </div>
          <form onSubmit={saveProfile}>
            <div className="profile-field">
              <label htmlFor="profile-display-name">Display name</label>
              <input id="profile-display-name" required maxLength={50} autoComplete="name" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setProfileMessage(""); }} />
            </div>
            <div className="profile-field">
              <label htmlFor="profile-avatar-url">Profile photo</label>
              <input id="profile-avatar-url" type="url" inputMode="url" maxLength={500} placeholder="https://example.com/you.jpg" value={avatarUrl} onChange={(event) => { setAvatarUrl(event.target.value); setProfileMessage(""); }} />
              <small>Paste an HTTPS image URL. Leave blank to use your initials.</small>
            </div>
            <div className="profile-form-actions">
              <button className="primary-button" disabled={profileBusy || (displayName.trim() === user.displayName && avatarUrl.trim() === (user.avatarUrl ?? ""))}>{profileBusy ? "Saving…" : "Save changes"}</button>
              {avatarUrl && <button className="text-button" type="button" disabled={profileBusy} onClick={useInitials}>Use initials instead</button>}
              {profileMessage && <span className={profileMessage === "Saved." ? "profile-status" : "profile-error"} role="status">{profileMessage}</span>}
            </div>
          </form>
        </section>
        <section className="invite-card profile-section">
          <div className="profile-section-heading">
            <p className="eyebrow">Grow the circle</p>
            <h2>Invite another writer</h2>
            <p>Generate a private, single-use link. It expires after seven days.</p>
          </div>
          {invitation && (
            <div className="invite-result">
              <div className="invite-link">
                <input
                  aria-label="Invitation link"
                  readOnly
                  value={invitation.inviteUrl}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button className="secondary-button" onClick={copyInvitation}>Copy</button>
              </div>
              <small>Valid until {formatDate(invitation.expiresAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.</small>
            </div>
          )}
          <button className={invitation ? "secondary-button" : "primary-button"} onClick={generateInvitation} disabled={inviteBusy}>
            {inviteBusy ? "Generating…" : invitation ? "Create another link" : "Generate invite link"}
          </button>
          {inviteMessage && <p className={inviteMessage === "Invitation copied." ? "invite-status" : "profile-error"} role="status">{inviteMessage}</p>}
        </section>
        <section className="settings-card profile-section">
          <div className="profile-section-heading"><h2>Circle settings</h2></div>
          <div className="settings-list">
            <div><span>Reveal</span><strong>{rules.unlockDay} at {rules.unlockTime}</strong></div>
            <div><span>Submissions</span><strong>Until Sunday ends</strong></div>
            <div><span>Timezone</span><strong>{rules.timeZone}</strong></div>
            <div><span>Writing format</span><strong>Markdown · .md</strong></div>
          </div>
        </section>
      </div>
      <div className="profile-footer"><button className="text-button profile-signout" onClick={onLogout}>Sign out</button></div>
    </div>
  );
}
