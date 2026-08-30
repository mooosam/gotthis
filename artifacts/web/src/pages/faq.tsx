import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";

interface FaqItem {
  q: string;
  a: string | ReactNode;
}

interface FaqSection {
  id: string;
  title: string;
  items: FaqItem[];
}

const sections: FaqSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    items: [
      { q: "What is GotThis?", a: "GotThis is a goal tracker that works through WhatsApp. You set goals, send progress updates, and see your progress on your dashboard." },
      { q: "Do I need to download an app?", a: "No. GotThis works through WhatsApp and your web browser." },
      { q: "How do I get started?", a: <>Create an account, add a goal, and start sending updates through WhatsApp. You can also <Link href="/sign-up">get started here</Link>.</> },
    ],
  },
  {
    id: "goals",
    title: "Goals & Progress",
    items: [
      { q: "What kinds of goals can I track?", a: "You can track goals that you can do, count, or finish. For example: read 10 pages, study for 30 minutes, write 500 words, or finish a project." },
      { q: "How do I update my progress?", a: "Send GotThis a simple WhatsApp message about what you did. For example: “I read 10 pages today.”" },
      { q: "What happens if I miss a day?", a: "Start again. One missed day does not end your goal. Send your next update when you are ready." },
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    items: [
      { q: "Why does GotThis use WhatsApp?", a: "WhatsApp is already part of many people's day. You can report progress without opening another productivity app." },
      { q: "Can GotThis check in with me?", a: "Yes. GotThis can use WhatsApp to help keep your goals in sight and make it easy to reply with your progress." },
    ],
  },
  {
    id: "account",
    title: "Account",
    items: [
      { q: "Where can I see all my goals?", a: "Open your GotThis dashboard. It shows your goals and progress in one place." },
      { q: "Can I use GotThis on my phone?", a: "Yes. You can use WhatsApp on your phone and open the GotThis website in your browser." },
    ],
  },
];

export default function FAQPage() {
  const [open, setOpen] = useState<string | null>(null);
  return <PublicLayout><main className="pub-faq-body"><div className="pub-wrap"><header className="pub-faq-hero"><h1>Questions about <em>GotThis.</em></h1><p>Simple answers to common questions.</p></header><div className="pub-faq-grid"><nav className="pub-faq-cats">{sections.map((section)=><a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav><div>{sections.map((section)=><section key={section.id} id={section.id} className="pub-faq-section"><h2>{section.title}</h2>{section.items.map((item)=>{const key=`${section.id}-${item.q}`;const isOpen=open===key;return <div className="pub-faq-item" key={item.q}><button className="pub-faq-q" onClick={()=>setOpen(isOpen?null:key)} aria-expanded={isOpen}>{item.q}<span className={`pub-faq-chevron${isOpen?" open":""}`}>⌄</span></button><div className={`pub-faq-a${isOpen?" open":""}`}><div className="pub-faq-a-inner">{item.a}</div></div></div>})}</section>)}</div></div></div></main></PublicLayout>;
}
