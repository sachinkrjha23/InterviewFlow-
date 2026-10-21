import { FaCreditCard, FaBug, FaUserShield } from "react-icons/fa";
import StaticPage, { MailLink } from "../components/StaticPage";

const topics = [
  {
    icon: <FaCreditCard size={16} />,
    tone: "bg-amber-soft text-amber-deep",
    title: "Payment problem",
    text: "Include your Razorpay order ID or payment ID, the amount, the date and a screenshot.",
  },
  {
    icon: <FaBug size={16} />,
    tone: "bg-rose-soft text-rose-deep",
    title: "Something isn't working",
    text: "Tell us what you did, what you expected, which browser you used, and attach a screenshot if you can.",
  },
  {
    icon: <FaUserShield size={16} />,
    tone: "bg-sky-soft text-sky-deep",
    title: "Data request",
    text: "To see, correct or delete your data, write from the email address on your account.",
  },
];

function Contact() {
  return (
    <StaticPage
      title="Contact us"
      intro="The quickest way to reach us is by email. We usually reply within 2 working days."
    >
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Email</p>
        <p className="mt-1 text-lg font-medium">
          <MailLink />
        </p>
      </div>

      <div>
        <h2 className="text-lg font-medium text-ink">What to include</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {topics.map((topic) => (
            <div key={topic.title} className="rounded-xl border border-line bg-surface p-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${topic.tone}`}>
                {topic.icon}
              </span>
              <h3 className="mt-3 text-sm font-medium text-ink">{topic.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{topic.text}</p>
            </div>
          ))}
        </div>
      </div>
    </StaticPage>
  );
}

export default Contact;