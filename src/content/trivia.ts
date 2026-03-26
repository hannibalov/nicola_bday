export interface TriviaQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  topic: "UK" | "1970s" | "Barcelona";
}

/** 10 questions, 4 options each (product spec). */
export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: "t1",
    prompt: "Which UK city is known as the Granite City?",
    options: ["Aberdeen", "Glasgow", "Edinburgh", "Inverness"],
    correctIndex: 0,
    topic: "UK",
  },
  {
    id: "t2",
    prompt: "What year did the UK join the European Communities (EEC)?",
    options: ["1970", "1973", "1975", "1979"],
    correctIndex: 1,
    topic: "UK",
  },
  {
    id: "t3",
    prompt: "Which river runs through London?",
    options: ["Thames", "Severn", "Mersey", "Trent"],
    correctIndex: 0,
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
    prompt: "Which disco anthem is associated with the 1970s?",
    options: [
      "I Will Survive — Gloria Gaynor",
      "Like a Virgin — Madonna",
      "U Can't Touch This — MC Hammer",
      "Smells Like Teen Spirit — Nirvana",
    ],
    correctIndex: 0,
    topic: "1970s",
  },
  {
    id: "t6",
    prompt: "Which band released 'Hotel California' in 1976?",
    options: ["Eagles", "Fleetwood Mac", "The Doobie Brothers", "Steely Dan"],
    correctIndex: 0,
    topic: "1970s",
  },
  {
    id: "t7",
    prompt: "La Rambla is a famous street in which Barcelona area?",
    options: ["Ciutat Vella", "Eixample", "Gràcia", "Barceloneta"],
    correctIndex: 0,
    topic: "Barcelona",
  },
  {
    id: "t8",
    prompt: "Which unfinished basilica is an icon of Barcelona?",
    options: ["Sagrada Família", "Cathedral of Barcelona", "Santa Maria del Mar", "Montserrat"],
    correctIndex: 0,
    topic: "Barcelona",
  },
  {
    id: "t9",
    prompt: "Barcelona hosted the Summer Olympics in which year?",
    options: ["1988", "1992", "1996", "2000"],
    correctIndex: 1,
    topic: "Barcelona",
  },
  {
    id: "t10",
    prompt: "Camp Nou is historically home to which club?",
    options: ["FC Barcelona", "RCD Espanyol", "Girona FC", "Betis"],
    correctIndex: 0,
    topic: "Barcelona",
  },
];
