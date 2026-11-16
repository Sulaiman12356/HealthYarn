import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { RedFlagAlertView } from "../components/RedFlagAlertView";
import { AnswerView } from "../components/AnswerView";

const MOCK_BUNDLE = {
  lang: "en",
  version_hash: "abc123",
  demo_mode: false,
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
      audio_url: "/static/audio/en/disclaimer.wav"
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
  audio_urls: ["/static/audio/en/ors_q.wav", "/static/audio/en/ors_a.wav"]
};

describe("HealthYarn Frontend Core Flows", () => {
  const playedUrls: string[] = [];

  beforeEach(() => {
    localStorage.clear();
    playedUrls.length = 0;

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

    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/topics")) {
          return new Response(
            JSON.stringify({
              lang: "en",
              demo_mode: true,
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
          return new Response(JSON.stringify(MOCK_BUNDLE), { status: 200 });
        }
        if (url.includes("/api/meta")) {
          return new Response(JSON.stringify({ demo_mode: true }), { status: 200 });
        }
        if (url.includes("/api/answers/9")) {
          return new Response(
            JSON.stringify({
              faq_id: 9,
              intent_key: "ors_how_to_prepare",
              lang: "en",
              question: MOCK_BUNDLE.topics[0].items[0].question,
              answer_text: MOCK_BUNDLE.topics[0].items[0].answer_text,
              question_audio_url: "/static/audio/en/ors_q.wav",
              answer_audio_url: "/static/audio/en/ors_a.wav",
              disclaimer_text: "General health information only.",
              disclaimer_audio_url: "/static/audio/en/disclaimer.wav",
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

  it("remembers language selection in localStorage", async () => {
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
          question_audio_url: "/static/audio/en/ors_q.wav",
          answer_audio_url: "/static/audio/en/ors_a.wav",
          disclaimer_text: "General info only.",
          disclaimer_audio_url: "/static/audio/en/disclaimer.wav",
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
      "/static/audio/en/ors_a.wav",
      "/static/audio/en/disclaimer.wav"
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
        messageAudioUrl="/static/audio/en/red_flag.wav"
        clinics={MOCK_BUNDLE.clinics}
        autoplayEnabled={true}
        onPlayClip={onPlayClip}
        onDismiss={onDismiss}
      />
    );

    const returnBtn = screen.getByRole("button", { name: /I understand/i });
    expect(returnBtn).toBeDisabled();
    expect(onPlayClip).toHaveBeenCalledWith("/static/audio/en/red_flag.wav");

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
});
