/**
 * Sample Calls (mock Grain mode)
 *
 * Participants line up with the demo directory in src/db/seed.ts.
 * Each sample exercises one matching path. `expectedActionItems` is the
 * eval answer key (npm run eval): the commitments made on the call, each
 * matched by keyword groups (every group must appear in the task; "a|b"
 * means either). Optional items may or may not be extracted.
 */

import { Participant } from '../../types/pipeline';

export interface ExpectedActionItem {
  owner: string;
  keywords: string[];
  optional?: boolean;
}

export interface SampleCall {
  id: string;
  title: string;
  /** Which matching path the sample exercises */
  scenario: string;
  durationSeconds: number;
  participants: Participant[];
  transcript: string;
  expectedActionItems: ExpectedActionItem[];
}

export const SAMPLE_CALLS: SampleCall[] = [
  {
    id: 'outreach-habits',
    title: 'Coaching session: Marcus / Dana',
    scenario: 'Matched by client email',
    durationSeconds: 1860,
    participants: [
      { name: 'Dana Lee', email: 'dana@coaching.example' },
      { name: 'Marcus Webb', email: 'marcus@acme.example' },
    ],
    transcript: `Dana Lee: Last week you committed to two hours of outreach every morning. How did it go?
Marcus Webb: Three out of five days. Wednesday and Thursday got eaten by support tickets.
Dana Lee: That's still a big step up from zero. What got in the way specifically?
Marcus Webb: The team pings me first because I answer fastest. If I hand tickets to Priya before 11, I think I can hold the mornings. I'll set that up by Friday.
Dana Lee: Good. I'll send you the outreach tracker template today so you can log touches.
Marcus Webb: Thanks. Honestly I'm worried the Q3 pipeline won't be enough to hit the target.
Dana Lee: Let's look at the numbers next week. Bring your current pipeline sheet to our next session.
Marcus Webb: Will do. I'm feeling better about the routine, just not the numbers.`,
    expectedActionItems: [
      { owner: 'Marcus Webb', keywords: ['ticket'] },
      { owner: 'Dana Lee', keywords: ['tracker|template'] },
      { owner: 'Marcus Webb', keywords: ['pipeline'] },
      { owner: 'Dana Lee', keywords: ['numbers'], optional: true },
    ],
  },
  {
    id: 'pricing-anxiety',
    title: 'Weekly coaching - Jordan',
    scenario: 'Matched by client email, second coach',
    durationSeconds: 2400,
    participants: [
      { name: 'Sam Ortiz', email: 'sam@coaching.example' },
      { name: 'Jordan Kim', email: 'jordan@globex.example' },
    ],
    transcript: `Sam Ortiz: You mentioned you wanted to talk about the price increase.
Jordan Kim: Yeah. We're raising prices 15 percent in November and I'm dreading telling our biggest account.
Sam Ortiz: What's the worst realistic outcome?
Jordan Kim: They push back and ask for a discount. They won't leave, they've been with us six years.
Sam Ortiz: So the real risk is margin, not churn. Can you lead with the new reporting features?
Jordan Kim: That's fair. I'll draft the announcement email and send it to you by Wednesday.
Sam Ortiz: I'll review it within a day of getting it. I'll also share the value-framing worksheet.
Jordan Kim: I've been sleeping badly over this, to be honest. Talking it through helps.
Sam Ortiz: That's normal before a hard conversation. We'll role-play the call next session.`,
    expectedActionItems: [
      { owner: 'Jordan Kim', keywords: ['announcement|email'] },
      { owner: 'Sam Ortiz', keywords: ['review'] },
      { owner: 'Sam Ortiz', keywords: ['worksheet'] },
      { owner: 'Sam Ortiz', keywords: ['role'], optional: true },
      { owner: 'Jordan Kim', keywords: ['role'], optional: true },
    ],
  },
  {
    id: 'hiring-plan',
    title: 'Northwind weekly sync',
    scenario: 'Client joined from a personal email; matched by title keyword',
    durationSeconds: 1500,
    participants: [
      { name: 'Dana Lee', email: 'dana@coaching.example' },
      { name: 'Priya Shah', email: 'priya.shah.home@gmail.com' },
    ],
    transcript: `Dana Lee: Sorry for the link mix-up. Where are you on the hiring plan?
Priya Shah: We got approval for two engineers. I haven't written the job descriptions yet.
Dana Lee: What's blocking you?
Priya Shah: I keep second-guessing the seniority. Do I hire one senior and one mid, or two mids?
Dana Lee: What does the roadmap need in the next six months?
Priya Shah: Someone who can own the data pipeline without hand-holding. So one senior for sure.
Dana Lee: Then start there. Can you have the senior JD drafted before our next call?
Priya Shah: Yes, I'll have it done by next Tuesday.
Dana Lee: I'll introduce you to a recruiter I trust. Expect an email from me tomorrow.
Priya Shah: That would be great. I'm excited, this team has been stretched thin for a year.`,
    expectedActionItems: [
      { owner: 'Priya Shah', keywords: ['jd|job description'] },
      { owner: 'Dana Lee', keywords: ['recruiter'] },
    ],
  },
  {
    id: 'missed-goals',
    title: 'Coaching session: Marcus / Dana',
    scenario: 'Matched by client email; negative sentiment and risks',
    durationSeconds: 2100,
    participants: [
      { name: 'Dana Lee', email: 'dana@coaching.example' },
      { name: 'Marcus Webb', email: 'marcus@acme.example' },
    ],
    transcript: `Dana Lee: How are you doing this week?
Marcus Webb: Not great. I missed the outreach goal every day and we lost the Hartwell deal.
Dana Lee: I'm sorry. What happened with Hartwell?
Marcus Webb: Their CFO went with a cheaper competitor. I should have looped in our CEO earlier.
Dana Lee: That's a useful lesson. How are you feeling about the program overall?
Marcus Webb: Frankly I'm wondering if it's worth the time right now. Everything feels like firefighting.
Dana Lee: That's important to hear. Let's cut the plan down to one priority for the next two weeks.
Marcus Webb: Okay. Pipeline review, then. I'll block Thursday afternoons for it.
Dana Lee: I'll check in with you on Friday by message to see how the first block went.`,
    expectedActionItems: [
      { owner: 'Marcus Webb', keywords: ['thursday|block'] },
      { owner: 'Dana Lee', keywords: ['check'] },
      { owner: 'Marcus Webb', keywords: ['priority'], optional: true },
      { owner: 'Dana Lee', keywords: ['priority'], optional: true },
    ],
  },
  {
    id: 'unknown-intro',
    title: 'Intro call',
    scenario: 'No known client and no title keyword; goes to the review queue',
    durationSeconds: 900,
    participants: [
      { name: 'Sam Ortiz', email: 'sam@coaching.example' },
      { name: 'Alex Rivera', email: 'alex@initech.example' },
    ],
    transcript: `Sam Ortiz: Thanks for making time, Alex. What made you reach out?
Alex Rivera: I just got promoted to head of sales and I've never managed managers before.
Sam Ortiz: Congratulations. What's the hardest part so far?
Alex Rivera: Running a forecast meeting without it turning into a status report.
Sam Ortiz: That's very common. I'll send you our program overview and a sample agenda.
Alex Rivera: Great, I'll review it with my VP and get back to you next week.`,
    expectedActionItems: [
      { owner: 'Sam Ortiz', keywords: ['overview|agenda'] },
      { owner: 'Alex Rivera', keywords: ['vp|review|get back'] },
    ],
  },
];

export const getSampleCall = (id: string): SampleCall | undefined =>
  SAMPLE_CALLS.find((sample) => sample.id === id);
