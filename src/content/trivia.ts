export interface TriviaQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  topic: "UK" | "1970s" | "Barcelona";
}

/** 20 questions, 4 options each (product spec). */
export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: "t1",
    prompt:
      "Bolton, Stockport, and Oldham sit inside which official English region?",
    options: [
      "Greater Manchester",
      "Merseyside",
      "Tyne and Wear",
      "West Yorkshire",
    ],
    correctIndex: 0,
    topic: "UK",
  },
  {
    id: "t2",
    prompt:
      "You're a 'Geordie' in the classic sense if you're from which city?",
    options: [
      "Manchester",
      "Liverpool",
      "Newcastle upon Tyne",
      "Leeds",
    ],
    correctIndex: 2,
    topic: "UK",
  },
  {
    id: "t3",
    prompt:
      "After the transition ended, since 1 January of which year have UK holidaymakers generally needed a passport (not an EU ID card on its own) for a normal Spanish holiday—extra paperwork, thanks Brexit!",
    options: ["2016", "2021", "2020", "2019"],
    correctIndex: 1,
    topic: "UK",
  },
  {
    id: "t4",
    prompt: "Which single by Queen topped charts in 1975?",
    options: [
      "Killer Queen",
      "Somebody to Love",
      "Bohemian Rhapsody",
      "You're My Best Friend",
    ],
    correctIndex: 2,
    topic: "1970s",
  },
  {
    id: "t5",
    prompt:
      "Which 1975 film made a generation think twice about the seaside?",
    options: [
      "Jaws",
      "Carrie",
      "Close Encounters of the Third Kind",
      "The Omen",
    ],
    correctIndex: 0,
    topic: "1970s",
  },
  {
    id: "t6",
    prompt: "Which band released 'Hotel California' in 1976?",
    options: [
      "Fleetwood Mac",
      "Eagles",
      "Steely Dan",
      "The Doobie Brothers",
    ],
    correctIndex: 1,
    topic: "1970s",
  },
  {
    id: "t7",
    prompt: "La Rambla is a famous street in which Barcelona area?",
    options: [
      "Eixample",
      "Gràcia",
      "Barceloneta",
      "Ciutat Vella",
    ],
    correctIndex: 3,
    topic: "Barcelona",
  },
  {
    id: "t8",
    prompt:
      "Barcelona's main 1992 Olympic stadium sits on which hill, known for museums and views over the port?",
    options: ["Collserola", "Montjuïc", "Tibidabo", "Montserrat"],
    correctIndex: 1,
    topic: "Barcelona",
  },
  {
    id: "t9",
    prompt: "Barcelona hosted the Summer Olympics in which year?",
    options: ["1996", "1988", "1992", "2000"],
    correctIndex: 2,
    topic: "Barcelona",
  },
  {
    id: "t10",
    prompt:
      "Barcelona's famous octagonal Eixample blocks came chiefly from which 19th‑century engineer‑planner?",
    options: [
      "Antoni Gaudí",
      "Le Corbusier",
      "Lluís Domènech i Montaner",
      "Ildefons Cerdà",
    ],
    correctIndex: 3,
    topic: "Barcelona",
  },
  {
    id: "t11",
    prompt:
      "England's deepest lake, Wastwater, sits in which national park—postcard peaks, damp boots, and debates about who forgot the waterproof?",
    options: [
      "Snowdonia (Eryri)",
      "Peak District",
      "North York Moors",
      "Lake District",
    ],
    correctIndex: 3,
    topic: "UK",
  },
  {
    id: "t12",
    prompt:
      "In the polite West Country cream‑tea split, which county is famous for cream first, then jam on the scone?",
    options: ["Cornwall", "Somerset", "Devon", "Dorset"],
    correctIndex: 2,
    topic: "UK",
  },
  {
    id: "t13",
    prompt:
      "Every spring, adults voluntarily ragdoll down Cooper's Hill chasing a cheese wheel near which English city—peak British commitment to snacks?",
    options: ["Oxford", "Canterbury", "Gloucester", "Bath"],
    correctIndex: 2,
    topic: "UK",
  },
  {
    id: "t14",
    prompt:
      "For years, BBC One often signed off at night with a girl playing noughts and crosses beside a clown—known as what?",
    options: [
      "Test Card F",
      "The Ceefax farewell dance",
      "The Blue Peter egg drop",
      "The EastEnders drum sting",
    ],
    correctIndex: 0,
    topic: "UK",
  },
  {
    id: "t15",
    prompt:
      "Cup of tea in a mug: when do you pour the milk if you’re not a heathen who goes milk‑first?",
    options: [
      "Before the hot water ever touches the cup",
      "After you've poured in the boiling water (brew, then lighten to taste)",
      "Only once the tea bag has fully dissolved into dust",
      "When someone shouts 'fancy a brew?' from the next room",
    ],
    correctIndex: 1,
    topic: "UK",
  },
  {
    id: "t16",
    prompt:
      "Which 1978 musical pairs Olivia Newton‑John and John Travolta at Rydell High?",
    options: [
      "All That Jazz",
      "Hair",
      "Saturday Night Fever",
      "Grease",
    ],
    correctIndex: 3,
    topic: "1970s",
  },
  {
    id: "t17",
    prompt:
      "Which 1979 Pink Floyd album produced the school‑choir hit 'Another Brick in the Wall Part 2'?",
    options: [
      "The Wall",
      "The Dark Side of the Moon",
      "London Calling — The Clash",
      "Rumours — Fleetwood Mac",
    ],
    correctIndex: 0,
    topic: "1970s",
  },
  {
    id: "t18",
    prompt:
      "Which 1976 underdog sports drama won Best Picture and made everyone jog in grey sweats?",
    options: [
      "Taxi Driver",
      "Network",
      "All the President's Men",
      "Rocky",
    ],
    correctIndex: 3,
    topic: "1970s",
  },
  {
    id: "t19",
    prompt:
      "Each August, one barrio’s streets become rival stage sets—papier‑mâché giants, cable‑tie canopy skies, and neighbours arguing over whose theme is weirder. Where does that week of glorious chaos happen?",
    options: ["Sants", "Poblenou", "Gràcia", "El Born"],
    correctIndex: 2,
    topic: "Barcelona",
  },
  {
    id: "t20",
    prompt:
      "On Montjuïc, crowds watch the Magic Fountain’s water‑and‑lights show. Straight uphill sits the big neo‑classical palace that is MNAC’s main building—what is it called?",
    options: [
      "Recinte Modernista de Sant Pau",
      "Casa Milà (La Pedrera)",
      "Palau Nacional",
      "Palau de la Música Catalana",
    ],
    correctIndex: 2,
    topic: "Barcelona",
  },
];
