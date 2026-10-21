import StaticPage, { Section, MailLink } from "../components/StaticPage";
import { OPERATOR_NAME, POLICIES_UPDATED } from "../utils/siteInfo.js";

const list = "list-disc space-y-1.5 pl-5";

function Privacy() {
  return (
    <StaticPage
      title="Privacy policy"
      updated={POLICIES_UPDATED}
      intro={`This page explains what InterviewFlow stores and who helps us run it. InterviewFlow is run by ${OPERATOR_NAME}. We don't show ads and we don't sell your data.`}
    >
      <Section title="1. What we store">
        <ul className={list}>
          <li>
            <span className="font-medium text-ink">Account:</span> your name, email and Google profile
            photo, plus a photo if you upload one.
          </li>
          <li>
            <span className="font-medium text-ink">Interviews:</span> the role, experience and mode you
            pick, the job description if you paste one, the questions, your typed answers, and the
            AI's scores and feedback.
          </li>
          <li>
            <span className="font-medium text-ink">Resume:</span> if you upload one, we read the text from
            its first two pages and keep that text and the skills found with your interview. The PDF
            itself is deleted right after reading.
          </li>
          <li>
            <span className="font-medium text-ink">Resume tailor:</span> the resume and job description
            you paste or upload there are sent to the AI to make the result. We don't save them on our
            servers. Your browser keeps your last result for this tab session so a refresh doesn't lose it.
          </li>
          <li>
            <span className="font-medium text-ink">Voice answers:</span> the transcript, plus pace, filler
            word and pause statistics for each recorded answer. The audio itself is not stored.
          </li>
          <li>
            <span className="font-medium text-ink">Payments:</span> order and payment IDs, the amount and
            the status. We never receive your card or UPI details.
          </li>
        </ul>
      </Section>

      <Section title="2. Who helps us run it">
        <ul className={list}>
          <li>Google and Firebase, for sign-in;</li>
          <li>
            OpenRouter, for the AI. It receives your role, experience, resume text, any job description
            you add, the questions and your answers;
          </li>
          <li>
            Groq, for speech-to-text, only if you record a voice answer. It receives the audio;
          </li>
          <li>Razorpay, for payments;</li>
          <li>Cloudinary, for profile photos you upload;</li>
          <li>our database and hosting providers.</li>
        </ul>
        <p>They handle data under their own privacy policies.</p>
      </Section>

      <Section title="3. Cookies and voice">
        <p>
          We use one cookie to keep you signed in, and no advertising or analytics cookies. The
          interviewer's voice uses your browser's built-in speech. Voice answers are optional: if you
          record one, your browser asks for microphone access and the audio is sent to a speech-to-text
          provider to make a transcript. We don't store the audio. We keep the transcript and simple
          speaking statistics (pace, filler words, pauses) with your answer.
        </p>
      </Section>

      <Section title="4. How long we keep it">
        <ul className={list}>
          <li>Interviews you don't finish are deleted automatically 14 days after they start.</li>
          <li>Finished interviews are kept until you ask us to delete them.</li>
          <li>Payment records are kept as long as we need them for accounting and payment questions.</li>
        </ul>
      </Section>

      <Section title="5. Your choices">
        <p>
          You can change your name, photo and sign-in email on the Profile page. To see your data or
          have your account and data deleted, email <MailLink /> from the address on your account.
        </p>
      </Section>

      <Section title="6. Changes and contact">
        <p>
          We may update this page, and the date at the top shows the latest version. Questions? Email{" "}
          <MailLink />.
        </p>
      </Section>
    </StaticPage>
  );
}

export default Privacy;