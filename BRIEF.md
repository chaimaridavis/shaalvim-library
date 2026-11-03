# Shaalvim English Library: build brief

Nov 3, 2026 · @Ariel Davis

## What the site is

A website where English-speaking families in Shaalvim lend each other their English books. Each member lists the books they own. Any member can browse or search every member's books, ask to borrow one, and get the owner's contact details to arrange pickup in person. The site keeps track of who has each book and who is waiting for it.

Members use it mostly on their phones, so every screen is designed for a phone first and must also work on a computer.

The design is a clickable mockup on a Claude design canvas with nine screens. Build the screens to match it: [Shaalvim English Library design](https://claude.ai/artifact/VD4tbiqekhAz1zKvGntQC5). Where this brief and the design disagree, this brief wins.

Ariel Davis runs the library. He is the only administrator in the first version. He is not a programmer, so explain any step he has to do himself in plain language, one step at a time.

## Technical setup

These choices are decided. Ariel already has accounts on GitHub, Supabase and Vercel.

| Part | Choice |
| --- | --- |
| Code storage | A new GitHub repository |
| Database, sign-in and stored files | Supabase, free plan |
| Hosting | Vercel, free plan, deployed automatically from GitHub |
| Web address | The free Vercel address for now. A custom domain may be added later. |
| Sign-in | A sign-in link sent to the member's email. No passwords. Google sign-in may be added later, so keep sign-in code easy to extend. |
| Emails the site sends | Supabase's built-in email for sign-in links only. Use a separate email-sending service with a free plan, such as Resend, for every other email. Confirm the free plan's limits before choosing. |
| Book details and covers | Look up title, author, cover image, first publication year and category in a free public catalog such as Open Library, with Google Books as a fallback. Store what is found so each book is looked up only once. |
| AI | None. The site does not call Claude or any other AI. |

Security rules:

- Never ask Ariel to paste a key or secret into a chat. Tell him exactly where to paste it, such as Vercel's environment settings.
- Use Supabase's row-level security so that a member's phone number and email can only be read by approved members, and only as the member's contact setting allows.
- Only Ariel's account can see the approvals screen or approve members.
- Members who are not yet approved can sign in but see only a "waiting for approval" message.

## Screens

A menu at the bottom of every screen after sign-in has four tabs: Browse, My books, Loans and Profile. Ariel also sees a link to Approvals.

1. **Browse.** A grid of book covers from every member, with title, author, owner and whether the book is available or lent out. When more than one member owns a book, show it once with the number of copies.
   - A search box searches all members' books by title or author.
   - Filter buttons for All, Children's, Fiction and Non-fiction.
   - A checkbox to show only books the member can borrow now.
   - When nothing matches, say so in a sentence.
2. **Book page, available.** Cover, title, author, first publication year, and each member who owns a copy with that copy's status. A "Request to borrow" button. After requesting, the member sees a confirmation, the owner's contact details (subject to the owner's contact setting) and a "Cancel request" link.
3. **Book page, lent out.** The same page, but showing how many people are waiting, with a "Join the waitlist" button. After joining, the member sees their place in line and a "Leave the waitlist" link. If another copy is available, show that copy's request button too.
4. **Member page.** Name, number of books, number lent out, contact button (subject to the member's contact setting) and a grid of the member's books.
5. **My books.** Two ways to add books, and the member's shelf with a remove button on each book.
   - **Add one book:** a search box. As the member types, show matching books from the catalog with covers. Tapping one adds it.
   - **Paste a list:** a large text box with the instruction "Paste a list of your books, one per line. Title and author is enough." Members can paste a list made by their own AI from a shelf photo, or type it. The site looks up each line and shows a results list with covers and a checkbox on each, checked by default. Lines with no confident match are marked "Not sure about this one" with a "Change" link that opens the single-book search. Lines with no match at all are listed separately with the same "Change" link. A button reads "Add 5 books to my shelf," with the number updating as boxes are checked.
   - When the catalog has no category for a book, the member picks Children's, Fiction or Non-fiction in the results list.
   - **Your shelf:** every book the member owns, its status, and a Remove button. Removing asks for confirmation first.
6. **Loans.** Four sections:
   - Requests for your books, each with "Mark as lent," "Decline" and a contact button.
   - Books you've lent out, each with the borrower, the date lent, an overdue note if the reminder time has passed, how many people are waiting, and a "Returned" button.
   - Books you've borrowed, each with the owner and the date. When overdue, a note and a "Tell \[owner\] I still need it" button.
   - Waitlists you're on, each with your place in line and a "Leave" button.
7. **Profile.** Name, email and WhatsApp number; contact setting; two lending limits; reminder timing; pause lending; Save; Sign out. The rules for each are in the next section.
8. **Sign up.** Full name, email and WhatsApp number, a note that only approved members can see the number, and an "Ask to join" button. After submitting, a message that an organizer will review the request and email them once approved. A "Sign in" link for existing members.
9. **Approvals (Ariel only).** Each person waiting to join with name, email and WhatsApp number, and "Approve" and "Decline" buttons.

## Rules

**Membership**

- Anyone can ask to join. Ariel approves or declines each request. Nobody sees books, names or contact details until approved.
- Ariel can remove a member. Removing a member removes their books and cancels their requests and waitlist places.

**Contact details.** Each member chooses one setting on their profile. The default is the first.

- WhatsApp for any member: approved members see the number on the member page and after requesting a book.
- WhatsApp after I accept a request: members see the number only after the owner taps "Accept" on their request. In this mode the request card shows "Accept" before "Mark as lent."
- Email only: members see the email address instead of the number.
- An owner always sees the contact details of a member who has requested their book, so the owner can reach out first.

**Borrowing**

1. A member taps "Request to borrow." The owner gets an email and sees the request on their Loans screen.
2. The owner arranges pickup with the member outside the site.
3. When the owner hands the book over, the owner taps "Mark as lent." The book shows as lent out, with the borrower and the date.
4. When the book comes back, the owner taps "Returned." The book shows as available again.
5. If the owner declines, the member gets an email.
6. Several members can request the same available book. The owner sees all of them. When the owner marks it lent to one member, the other requests move to the waitlist in the order they were made, and those members get an email saying so.

**Lending limits.** By default there are no limits. An owner can set either or both on their profile: the most books they lend out at one time, and the most books one person can borrow from them at one time. Each shows "No limit" until the owner picks a number. When either limit is reached, a new request goes on that book's waitlist instead, and the member is told why.

**Waitlist**

- A member can join the waitlist for any book that is lent out. The line is in the order members joined. Whenever someone joins, the member who currently has the book gets an email saying someone is waiting for it.
- When the book is marked returned, the first person in line gets an email, which also says how many others are waiting, and a request is created for them automatically. The owner then handles it like any request.
- There is no time limit: the first person keeps their turn until they cancel or the owner declines. Then the next person in line gets the same treatment.
- Members can leave a waitlist at any time.

**Overdue reminders.** Each owner chooses when borrowers get a reminder: two weeks, one month, two months, or never. The default is one month. When the time passes, the borrower gets one email, and the owner's Loans screen shows the book as overdue. If the borrower taps "Tell \[owner\] I still need it," the owner gets an email and the reminder clock starts again.

**Pause lending.** While paused, an owner's books stay listed but show "Not lending right now" instead of the request and waitlist buttons. Existing loans, requests and waitlists are kept.

**Removing a book.** The site asks for confirmation. Open requests for that copy are cancelled, and anyone waiting for it gets an email. If the book is lent out, the loan record is kept until the owner marks it returned.

**Requests do not expire.** A request stays open until the member cancels it or the owner declines or lends the book.

## Emails the site sends

All emails are short and plain, in English, and link to the relevant screen.

| When | Who gets it |
| --- | --- |
| Someone asks to join | Ariel |
| A member is approved or declined | That member |
| A member signs in | That member (the sign-in link) |
| Someone requests your book | The owner |
| An owner declines your request | The member who asked |
| Your request moves to a waitlist | The member who asked |
| It's your turn on a waitlist | The first person in line |
| A book you're waiting for is removed | Everyone on its waitlist |
| Your borrowed book reaches the reminder time | The borrower |
| A borrower says they still need your book | The owner |
| Someone joins the waitlist for a book you have | The current borrower |

## Look and feel

Quiet and bookish, in the style of Goodreads. The book covers carry the visual interest; everything else stays plain.

| Element | Value |
| --- | --- |
| Page background | #F6F3EC (warm off-white) |
| Cards and menu background | #FFFDF8 |
| Main text | #2B2118 |
| Secondary text | #6B5E52 |
| Lines and borders | #E4DDD0 |
| Buttons and "Available" | #2F5D50 (dark green), white button text |
| "Lent out" and warnings | #8A4B12 |
| Titles and book names | Merriweather, from Google Fonts |
| Everything else | Lato, from Google Fonts |

- No gradients, emoji or decorative icons. Use simple line icons only where the design has them.
- Buttons are at least 44 pixels tall so they are easy to tap.
- Show real covers from the catalog. When there is no cover, show a plain colored block with the title and author in white, as in the design.
- Text must stay readable for older members: body text at least 15 pixels, and colors as listed, which pass standard contrast checks.

## Not in the first version

These may be added later. Don't build them now, but don't make choices that would block them.

- Google sign-in.
- A custom web address.
- Adding books from a photo inside the site.
- More than one administrator.

## How to work with Ariel

- Build in small stages, and after each one tell Ariel in plain language what now works and how to try it.
- Suggested order: accounts and sign-in, then adding and browsing books, then requests and loans, then waitlists, limits, reminders and pause, then emails.
- When Ariel has to do something himself, such as copying a setting into Vercel, give one step at a time with the exact screen and button names, and wait for him to confirm.
- Avoid technical terms. When one can't be avoided, explain it in a sentence.
- Before building anything not described in this brief, ask Ariel first.
