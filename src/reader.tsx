import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "./api";
import type { CelebrationKind } from "./Confetti";
import { formatDate, plainWordCount, wordCount } from "./format";
import { Avatar, EmptyState, Loading } from "./shared-ui";
import type { FullEssay } from "./types";

const Markdown = lazy(() => import("./Markdown").then((module) => ({ default: module.Markdown })));

function ReadingPet() {
  const [napping, setNapping] = useState(false);
  const [dead, setDead] = useState(false);
  const petAction = dead ? "The reading cat is dead" : napping ? "Wake the reading cat" : "Let the reading cat nap";
  return (
    <button
      type="button"
      className={`reading-pet ${napping ? "napping" : ""} ${dead ? "dead" : ""}`}
      onClick={(event) => { if (!dead && event.detail < 2) setNapping((current) => !current); }}
      onDoubleClick={() => { setDead(true); setNapping(false); }}
      aria-label={petAction}
      title={dead ? "Rest in pixels." : `${petAction}. Double-click at your own risk.`}
    >
      <img src={napping ? "/pets/cat-sleep.gif" : "/pets/cat-walk.gif"} alt="" aria-hidden="true" />
      <span className="pet-grave" aria-hidden="true">RIP</span>
    </button>
  );
}

export function Reader({ essayIds, onClose, onCelebrate }: { essayIds: string[]; onClose: () => void; onCelebrate: (kind: CelebrationKind) => void }) {
  const [index, setIndex] = useState(0);
  const [essay, setEssay] = useState<FullEssay | null>(null);
  const [error, setError] = useState("");
  const [heartError, setHeartError] = useState("");
  const [heartBusy, setHeartBusy] = useState(false);
  const [petitMotBody, setPetitMotBody] = useState("");
  const [petitMotBusy, setPetitMotBusy] = useState(false);
  const [petitMotMessage, setPetitMotMessage] = useState("");
  const page = useRef<HTMLDivElement>(null);
  const essayId = essayIds[index];

  useEffect(() => {
    let active = true;
    setEssay(null);
    setError("");
    setHeartError("");
    setPetitMotBody("");
    setPetitMotMessage("");
    page.current?.scrollTo({ top: 0 });
    api.essay(essayId)
      .then((result) => {
        if (!active) return;
        setEssay(result.essay);
        setPetitMotBody(result.essay.petitMots.find((petitMot) => petitMot.isMine)?.body ?? "");
      })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [essayId]);

  useEffect(() => {
    function navigate(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && index > 0) setIndex((current) => current - 1);
      if (event.key === "ArrowRight" && index < essayIds.length - 1) setIndex((current) => current + 1);
    }
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, [essayIds.length, index]);

  async function toggleHeart() {
    if (!essay || essay.isMine || heartBusy) return;
    const next = !essay.heartedByMe;
    setHeartBusy(true);
    setHeartError("");
    try {
      const result = await api.setEssayHeart(essay.id, next);
      setEssay((current) => current && current.id === essay.id
        ? { ...current, heartedByMe: result.hearted, heartCount: result.heartCount }
        : current);
      if (result.hearted) onCelebrate("heart");
    } catch (cause) {
      setHeartError(cause instanceof Error ? cause.message : "Could not save your heart");
    } finally {
      setHeartBusy(false);
    }
  }

  async function savePetitMot(event: FormEvent) {
    event.preventDefault();
    if (!essay || essay.isMine || petitMotBusy) return;
    setPetitMotBusy(true);
    setPetitMotMessage("");
    try {
      const result = await api.setPetitMot(essay.id, petitMotBody);
      setEssay((current) => current && current.id === essay.id
        ? {
          ...current,
          petitMots: current.petitMots.some((petitMot) => petitMot.isMine)
            ? current.petitMots.map((petitMot) => petitMot.isMine ? result.petitMot : petitMot)
            : [...current.petitMots, result.petitMot],
        }
        : current);
      setPetitMotBody(result.petitMot.body);
      setPetitMotMessage("Your petit mot is saved.");
    } catch (cause) {
      setPetitMotMessage(cause instanceof Error ? cause.message : "Could not save your petit mot");
    } finally {
      setPetitMotBusy(false);
    }
  }

  function next() {
    if (index === essayIds.length - 1) onClose();
    else setIndex((current) => current + 1);
  }

  function download() {
    if (!essay) return;
    const blob = new Blob([essay.markdown], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${essay.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "essay"}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="overlay-page reader-page" ref={page}>
      <header className="overlay-header">
        <button className="text-button" onClick={onClose}>← Back</button>
        <p>{essayIds.length > 1 ? `${index + 1} of ${essayIds.length}` : "Reading room"}</p>
        <button className="text-button" onClick={download} disabled={!essay}>↓ .md</button>
      </header>
      {error ? <EmptyState title="Couldn’t open this essay" copy={error} /> : !essay ? <Loading /> : (
        <main className="reader-shell">
          <p className="eyebrow">{formatDate(essay.weekKey, { month: "long", day: "numeric", year: "numeric" })}</p>
          <h1>{essay.title}</h1>
          <div className="byline"><Avatar user={essay.author} /><span>By {essay.author.displayName}<small>{wordCount(essay.markdown)} words</small></span></div>
          <Suspense fallback={<Loading />}><Markdown source={essay.markdown} /></Suspense>
          <section className="reader-response" aria-label="Essay response">
            <button
              className={`heart-button ${essay.heartedByMe ? "hearted" : ""}`}
              aria-pressed={essay.heartedByMe}
              disabled={essay.isMine || heartBusy}
              onClick={toggleHeart}
            >
              <span aria-hidden="true">{essay.heartedByMe ? "♥" : "♡"}</span>
              {essay.isMine ? "Your essay" : essay.heartedByMe ? "Loved" : "Show some love"}
              {essay.heartCount > 0 && <small>{essay.heartCount}</small>}
            </button>
            {heartError && <p className="reader-response-error" role="alert">{heartError}</p>}
          </section>
          <section className="petit-mots" aria-labelledby="petit-mots-heading">
            <div className="petit-mots-heading">
              <div>
                <p className="eyebrow">Thoughts from the circle</p>
                <h2 id="petit-mots-heading">Petits mots</h2>
              </div>
              <span>{essay.petitMots.length}</span>
            </div>
            {essay.petitMots.length > 0 ? (
              <div className="petit-mot-list">
                {essay.petitMots.map((petitMot) => (
                  <article className="petit-mot" key={petitMot.author.id}>
                    <Avatar user={petitMot.author} />
                    <div>
                      <p>{petitMot.body}</p>
                      <small>{petitMot.author.displayName}{petitMot.isMine ? " · you" : ""}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="petit-mots-empty">No petits mots yet.</p>
            )}
            {!essay.isMine && (
              <form className="petit-mot-form" onSubmit={savePetitMot}>
                <label htmlFor={`petit-mot-${essay.id}`}>
                  {essay.petitMots.some((petitMot) => petitMot.isMine) ? "Edit your petit mot" : "Leave a petit mot"}
                </label>
                <textarea
                  id={`petit-mot-${essay.id}`}
                  maxLength={2_000}
                  placeholder="Share a thought, a feeling, or a line that stayed with you…"
                  value={petitMotBody}
                  onChange={(event) => { setPetitMotBody(event.target.value); setPetitMotMessage(""); }}
                />
                <div className="petit-mot-form-footer">
                  <span className={plainWordCount(petitMotBody) > 100 ? "over-limit" : ""}>{plainWordCount(petitMotBody)} / 100 words</span>
                  <button className="secondary-button" disabled={petitMotBusy || !petitMotBody.trim() || plainWordCount(petitMotBody) > 100}>
                    {petitMotBusy ? "Saving…" : "Share"}
                  </button>
                </div>
                {petitMotMessage && <p className={petitMotMessage === "Your petit mot is saved." ? "petit-mot-success" : "reader-response-error"} role="status">{petitMotMessage}</p>}
              </form>
            )}
          </section>
          {essayIds.length > 1 && (
            <nav className="reader-batch-nav" aria-label="Weekly essay batch">
              <button className="text-button" disabled={index === 0} onClick={() => setIndex((current) => current - 1)}>← Previous</button>
              <span>Essay {index + 1} of {essayIds.length}</span>
              <button className="primary-button" onClick={next}>{index === essayIds.length - 1 ? "Finish batch" : "Next essay →"}</button>
            </nav>
          )}
          <ReadingPet />
        </main>
      )}
    </div>
  );
}
