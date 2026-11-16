import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { RedFlagAlertView } from "../components/RedFlagAlertView";
import { AnswerView } from "../components/AnswerView";

const MOCK_BUNDLE = {
  lang: "en",
  version_hash: "abc123",
  demo_mode: false,
  content_reviewed: true,
  meta: {
    content_last_updated: "2026-11-16",
    clinical_reviewers: "Dr. Test",
    language_reviewers: "Team Test"
  },
  topics: [
    {
      id: 1,
      slug: "child_diarrhoea_ors",
      icon: "droplet",
      sort_order: 1,
      name: "Child Diarrhoea & ORS",
      description: "Mixing ORS safely",
      items: [
        {
          faq_id: 9,
          intent_key: "ors_how_to_prepare",
          source_reference: "WHO ORS Guide",
          question: "How do I prepare ORS for my child?",
          answer_text: "Mix one sachet in 1L clean water.",
          question_audio_url: "/static/audio/en/ors_q.ogg",
          answer_audio_url: "/static/audio/en/ors_a.ogg"
        }
      ]
    }
  ],
  system_messages: {
    disclaimer: {
      text: "General health information only.",
      audio_url: "/static/audio/en/disclaimer.ogg"
    }
  },
  clinics: [
    {
      id: 1,
      name: "Ikeja Primary Health Centre",
      lga: "Ikeja",
      state: "Lagos",
      phone: "+2348001122001",
      type: "Primary Health Centre",
      lat: 6.6,
      lng: 3.35
    }
  ],
  audio_urls: ["/static/audio/en/ors_q.ogg", "/static/audio/en/ors_a.ogg"]
};

describe("HealthYarn Landing & App Core Flows", () => {
  const playedUrls: string[] = [];
  let mockContentReviewed = true;

  beforeEach(() => {
    localStorage.clear();
    playedUrls.length = 0;
    mockContentReviewed = true;
    window.history.pushState({}, "", "/");
    document.documentElement.lang = "en";

    class MockAudio {
      src: string;
      playbackRate = 1.0;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(src: string) {
        this.src = src;
      }
      play() {
        playedUrls.push(this.src);
        return Promise.resolve();
      }
      pause() {}
    }

    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/topics")) {
          return new Response(
            JSON.stringify({
              lang: "en",
              demo_mode: !mockContentReviewed,
              topics: MOCK_BUNDLE.topics.map((t) => ({
                id: t.id,
                slug: t.slug,
                icon: t.icon,
                sort_order: t.sort_order,
                name: t.name,
                description: t.description,
                questions: t.items
              }))
            }),
            { status: 200 }
          );
        }
        if (url.includes("/api/bundle")) {
          return new Response(
            JSON.stringify({ ...MOCK_BUNDLE, content_reviewed: mockContentReviewed }),
            { status: 200 }
          );
        }
        if (url.includes("/api/meta")) {
          return new Response(
            JSON.stringify({
              demo_mode: !mockContentReviewed,
              content_reviewed: mockContentReviewed,
              content_last_updated: "2026-11-16",
              clinical_reviewers: "Dr. Test",
              language_reviewers: "Team Test",
              sample_audio: {
                en: "/static/audio/en/ors_a.ogg",
                yo: "/static/audio/yo/ors_a.ogg",
                pcm: null
              },
              hero_audio: { en: null, yo: null, pcm: null }
            }),
            { status: 200 }
          );
        }
        if (url.includes("/api/answers/9")) {
          return new Response(
            JSON.stringify({
              faq_id: 9,
              intent_key: "ors_how_to_prepare",
              lang: "en",
              question: MOCK_BUNDLE.topics[0].items[0].question,
              answer_text: MOCK_BUNDLE.topics[0].items[0].answer_text,
              question_audio_url: "/static/audio/en/ors_q.ogg",
              answer_audio_url: "/static/audio/en/ors_a.ogg",
              disclaimer_text: "General health information only.",
              disclaimer_audio_url: "/static/audio/en/disclaimer.ogg",
              log_id: 42
            }),
            { status: 200 }
          );
        }
        return new Response("{}", { status: 200 });
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("switches landing page copy across EN, Pidgin, and Yorùbá with zero Igbo and plays sample clip", async () => {
    const { container } = render(<App />);

    expect(
      await screen.findByText("Ask in your language. Hear an answer you can trust.")
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(container.textContent).not.toMatch(/\bIgbo\b/i);

    const sampleBtn = await screen.findByRole("button", { name: "Hear a sample answer" });
    fireEvent.click(sampleBtn);
    expect(playedUrls).toContain("/static/audio/en/ors_a.ogg");

    fireEvent.click(screen.getAllByRole("button", { name: "Pidgin" })[0]);
    expect(
      await screen.findByText("Ask for your own language. Hear answer wey you fit trust.")
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("pcm");
    expect(screen.queryByRole("button", { name: "Hear sample answer" })).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Yorùbá" })[0]);
    expect(
      await screen.findByText("Béèrè ní èdè rẹ. Gbọ́ ìdáhùn tí o lè gbẹ́kẹ̀lé.")
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("yo");
    expect(container.textContent).not.toMatch(/\bIgbo\b/i);
  });

  it("shows 'Demo content, under review' when CONTENT_REVIEWED is false", async () => {
    mockContentReviewed = false;
    render(<App />);
    expect(await screen.findByText("Demo content, under review")).toBeInTheDocument();
  });

  it("navigates from landing page CTA to /app preserving selected language", async () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Yorùbá" })[0]);
    const ctas = await screen.findAllByRole("button", { name: "Béèrè ìbéèrè" });
    fireEvent.click(ctas[0]);

    expect(window.location.pathname).toBe("/app");
    expect(localStorage.getItem("healthyarn_lang")).toBe("yo");
    expect(await screen.findByText("Àwọn àkòrí ìlera")).toBeInTheDocument();
  });

  it("remembers language selection in /app language picker", async () => {
    window.history.pushState({}, "", "/app");
    render(<App />);
    const yorubaBtn = await screen.findByRole("button", { name: /Yorùbá —/i });
    fireEvent.click(yorubaBtn);
    expect(localStorage.getItem("healthyarn_lang")).toBe("yo");
    expect(await screen.findByText("Àwọn àkòrí ìlera")).toBeInTheDocument();
  });

  it("renders answer screen and plays audio", async () => {
    const playSeq = vi.fn();
    render(
      <AnswerView
        lang="en"
        answer={{
          faq_id: 9,
          intent_key: "ors_how_to_prepare",
          lang: "en",
          question: "How do I prepare ORS?",
          answer_text: "Mix one sachet in 1L clean water.",
          question_audio_url: "/static/audio/en/ors_q.ogg",
          answer_audio_url: "/static/audio/en/ors_a.ogg",
          disclaimer_text: "General info only.",
          disclaimer_audio_url: "/static/audio/en/disclaimer.ogg",
          log_id: 1
        }}
        autoplayEnabled={true}
        isPlaying={false}
        playbackRate={1.0}
        onPlayAnswerSequence={playSeq}
        onToggleSpeed={vi.fn()}
        onFeedback={vi.fn(async () => {})}
        onResetHome={vi.fn()}
      />
    );

    expect(screen.getByText("Mix one sachet in 1L clean water.")).toBeInTheDocument();
    expect(playSeq).toHaveBeenCalledWith(
      "/static/audio/en/ors_a.ogg",
      "/static/audio/en/disclaimer.ogg"
    );
  });

  it("prevents dismissing RedFlagAlertView for 5 seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const onPlayClip = vi.fn();
    render(
      <RedFlagAlertView
        lang="en"
        messageText="Urgent medical danger sign."
        messageAudioUrl="/static/audio/en/red_flag.ogg"
        clinics={MOCK_BUNDLE.clinics}
        autoplayEnabled={true}
        onPlayClip={onPlayClip}
        onDismiss={onDismiss}
      />
    );

    const returnBtn = screen.getByRole("button", { name: /I understand/i });
    expect(returnBtn).toBeDisabled();
    expect(onPlayClip).toHaveBeenCalledWith("/static/audio/en/red_flag.ogg");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(returnBtn).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(returnBtn).not.toBeDisabled();
    fireEvent.click(returnBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows cached topics and opens answers when offline", async () => {
    window.history.pushState({}, "", "/app");
    localStorage.setItem("healthyarn_lang", "en");
    localStorage.setItem("healthyarn_bundle_v1_en", JSON.stringify(MOCK_BUNDLE));
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network offline")))
    );

    render(<App />);
    expect(await screen.findByText(/Voice needs internet/i)).toBeInTheDocument();
    const topicBtn = await screen.findByRole("button", { name: /Child Diarrhoea & ORS/i });
    fireEvent.click(topicBtn);

    const qBtn = await screen.findByRole("button", {
      name: /Open answer: How do I prepare ORS/i
    });
    fireEvent.click(qBtn);

    await waitFor(() => {
      expect(screen.getByText("Mix one sachet in 1L clean water.")).toBeInTheDocument();
    });
  });

  it("clears stale English topics if switching to Pidgin fails or has no cache", async () => {
    window.history.pushState({}, "", "/app");
    localStorage.setItem("healthyarn_lang", "en");

    render(<App />);
    expect(await screen.findByRole("button", { name: /Child Diarrhoea & ORS/i })).toBeInTheDocument();

    // Simulate backend rejecting lang=pcm (e.g., stale server)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"detail":"Unsupported language"}', { status: 400 }))
    );

    fireEvent.click(screen.getByRole("button", { name: "Nigerian Pidgin" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Child Diarrhoea & ORS/i })).toBeNull();
    });
  });
});
