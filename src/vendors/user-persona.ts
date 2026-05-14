// Fictional user persona that the FRIENDS "remember".
// This data lives inside each friend's process, simulating that real friends
// actually know the user — they accumulate context over years of relationship.
// (The shoe-seller agents have no such context — they don't know the user.)

export const USER_PERSONA = {
  name: 'Casey',
  pronouns: 'they/them',
  shorthand: [
    'Casey is 31, lives in Prospect Heights, Brooklyn. Grew up in Boulder, CO; state school undergrad.',
    'Backend dev at a small fintech (Series B, ~40 people). Got a small promotion in April but no raise yet.',
    'Lives alone with a Russian Blue cat named Miso. Plants: a too-large monstera and a fiddle leaf that\'s mad at them.',
    'Allergic to shellfish. Knee injury from a 2022 marathon attempt — walks more than runs now. Sees a PT monthly.',
    'Food: loves spicy + umami. Korean and Sichuan kicks lately. Cooks 3-4 nights/week. Sourdough discard always sitting too long in the fridge.',
    'Travel: Tokyo (Mar 2024 with Alex), Lisbon (2022 solo), Berlin (2021 with college friends). One international trip a year. Prefers trains over flights.',
    'Hobbies: pottery class every Saturday morning at Greenwich House. Mid-build on a custom mechanical keyboard (lubed Boba U4Ts). Reads slowly, mostly nonfiction + translated fiction.',
    'Routine: Sey or Devoción coffee. Same Prospect Park loop 4x/week. Sundays = laundry + groceries + brushing Miso.',
    'Music: jazz and ambient lately. Phase with sad Norwegian indie.',
    'Slightly avoidant — says yes to plans then bails 30% of the time. Trying to be better.',
    'Just rolled off a long burnout — took two weeks off in February. Not overcommitting now.',
    'Single, not actively dating. Close friends are scattered geographically.',
  ].join(' '),
} as const;

export const FRIEND_MEMORIES = {
  alex: [
    "We went to Tokyo together in March '24 — you skipped the famous ramen spot for the hole-in-the-wall in Yanaka. Best call of the trip.",
    'Your shellfish allergy nuked our omakase plan in Tsukiji. We did the tonkatsu place instead, you weren\'t mad about it.',
    'You twisted your ankle on Mt. Takao and limped through the rest of the week. You said "I\'m fine" eleven times.',
    "You're the friend who always picks the place with the better natural wine list. Lambrusco era is concerning.",
    'You make me try the weird fermented thing at every new place.',
    'You said you wanted to do a Korea trip "next year" — that was a year ago.',
  ],
  sam: [
    'Mom still brings up your 2022 marathon knee. Pretty sure she\'ll mention it next call too.',
    "Aunt Marie's wedding is October — you said you'd bring Miso, which Mom now relays like it's the actual plan.",
    'You hated anything trail-shaped after that Bear Lake hike when we were kids.',
    'Dad still uses the lamp you made in pottery class. Tells everyone about it.',
    'You owe me $40 from the airport ride in May.',
    "Dad's truck broke down again. Don't tell him I told you.",
    'Remember when you tried to teach me to skateboard and broke your own wrist?',
  ],
  pat: [
    'Honey — what about your knee? You said you\'d ease back in slowly.',
    'Did you ever get that leak in the bathroom looked at?',
    "I'm still upset you took the redeye to Tokyo. Your back was a mess for a week.",
    'Have you been doing the PT exercises? I will know if you haven\'t.',
    'Your sister and I are coming through New York in November — we\'ll need a couch for a night.',
    "Don't forget Miso's vet check is coming up. Russian Blues need their teeth looked at.",
    'I taped that NYT article about sleep for you. Mailed it last week.',
  ],
  jordan: [
    'remember sophomore year we tried to brew kombucha in the dorm. great times. terrible kombucha',
    'u still at that fintech place',
    "i still have ur copy of infinite jest btw. been 9 years. it's mine now technically",
    'wait did u ever finish that keyboard build',
    "freshman year u tried to lift for a month then quit. don't make me bring that up",
    'u still doing the saturday pottery thing',
    "i was in brooklyn last fall and didn't tell u. my bad",
  ],
} as const;

export type FriendKey = keyof typeof FRIEND_MEMORIES;
