// Clubs and national teams with squads (2025-26 season, best effort — transfers may make some out of date).
// Squad format: "number Name POS rating; ..." where POS is GK, DF, MF or FW.
// Kit format: [shirt, stripe colour or null, shorts, socks].

const T = (id, name, short, home, away, squad) => ({ id, name, short, home, away, squad: parseSquad(squad) });

function parseSquad(s) {
  return s.split(';').map((e) => e.trim()).filter(Boolean).map((e) => {
    const parts = e.split(/\s+/);
    const num = +parts[0], r = +parts[parts.length - 1], pos = parts[parts.length - 2];
    const name = parts.slice(1, -2).join(' ');
    return { num, name, pos, r };
  });
}

export const PREMIER_LEAGUE = [
  T('ARS', 'Arsenal', 'ARS', ['#EF0107', null, '#FFFFFF', '#FFFFFF'], ['#1C2C5B', null, '#1C2C5B', '#1C2C5B'],
    `1 David Raya GK 86; 13 Kepa Arrizabalaga GK 79; 2 William Saliba DF 88; 6 Gabriel Magalhães DF 87; 12 Jurriën Timber DF 83;
     33 Riccardo Calafiori DF 81; 5 Piero Hincapié DF 81; 3 Cristhian Mosquera DF 77; 41 Declan Rice MF 88; 36 Martín Zubimendi MF 86;
     8 Martin Ødegaard MF 87; 10 Eberechi Eze MF 84; 23 Mikel Merino MF 82; 7 Bukayo Saka FW 88; 14 Viktor Gyökeres FW 85;
     19 Leandro Trossard FW 81; 11 Gabriel Martinelli FW 82; 20 Noni Madueke FW 80; 29 Kai Havertz FW 82`),
  T('AVL', 'Aston Villa', 'AVL', ['#670E36', null, '#FFFFFF', '#670E36'], ['#95BFE5', null, '#670E36', '#95BFE5'],
    `23 Emiliano Martínez GK 86; 40 Marco Bizot GK 75; 2 Matty Cash DF 79; 4 Ezri Konsa DF 81; 14 Pau Torres DF 82; 12 Lucas Digne DF 77;
     3 Victor Lindelöf DF 77; 22 Ian Maatsen DF 78; 8 Youri Tielemans MF 82; 44 Boubacar Kamara MF 82; 27 Morgan Rogers MF 83;
     7 John McGinn MF 80; 24 Amadou Onana MF 80; 10 Emiliano Buendía MF 78; 11 Ollie Watkins FW 83; 19 Jadon Sancho FW 78; 29 Evann Guessand FW 77`),
  T('BOU', 'Bournemouth', 'BOU', ['#DA291C', '#111111', '#111111', '#111111'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `1 Đorđe Petrović GK 79; 40 Will Dennis GK 68; 20 Álex Jiménez DF 75; 5 Marcos Senesi DF 78; 18 Bafodé Diakité DF 76; 3 Adrien Truffert DF 77;
     15 Adam Smith DF 73; 8 Alex Scott MF 77; 4 Lewis Cook MF 76; 12 Tyler Adams MF 77; 10 Ryan Christie MF 75; 16 Marcus Tavernier MF 77;
     24 Antoine Semenyo FW 82; 19 Justin Kluivert FW 79; 9 Evanilson FW 78; 21 Amine Adli FW 76; 22 Eli Junior Kroupi FW 74`),
  T('BRE', 'Brentford', 'BRE', ['#E30613', '#FFFFFF', '#111111', '#E30613'], ['#FFD200', null, '#111111', '#FFD200'],
    `1 Caoimhín Kelleher GK 80; 12 Hákon Rafn Valdimarsson GK 72; 22 Nathan Collins DF 79; 5 Ethan Pinnock DF 77; 4 Sepp van den Berg DF 77;
     20 Kristoffer Ajer DF 76; 33 Michael Kayode DF 75; 3 Rico Henry DF 75; 6 Jordan Henderson MF 78; 27 Vitaly Janelt MF 75;
     8 Mathias Jensen MF 76; 24 Mikkel Damsgaard MF 78; 18 Yehor Yarmolyuk MF 74; 7 Kevin Schade FW 77; 9 Igor Thiago FW 79;
     19 Dango Ouattara FW 78; 23 Keane Lewis-Potter FW 75`),
  T('BHA', 'Brighton', 'BHA', ['#0057B8', '#FFFFFF', '#0057B8', '#0057B8'], ['#FFD100', null, '#1B1B1B', '#FFD100'],
    `1 Bart Verbruggen GK 80; 23 Jason Steele GK 72; 29 Jan Paul van Hecke DF 80; 5 Lewis Dunk DF 78; 4 Adam Webster DF 76;
     24 Ferdi Kadıoğlu DF 79; 3 Maxim De Cuyper DF 77; 34 Joël Veltman DF 75; 20 Carlos Baleba MF 82; 27 Mats Wieffer MF 77;
     13 Jack Hinshelwood MF 76; 8 Diego Gómez MF 77; 6 James Milner MF 74; 22 Kaoru Mitoma FW 81; 17 Yankuba Minteh FW 79;
     10 Georginio Rutter FW 79; 18 Danny Welbeck FW 76`),
  T('BUR', 'Burnley', 'BUR', ['#6C1D45', null, '#FFFFFF', '#6C1D45'], ['#99D6EA', null, '#6C1D45', '#99D6EA'],
    `1 Martin Dúbravka GK 77; 13 Max Weiß GK 71; 2 Kyle Walker DF 78; 5 Maxime Estève DF 77; 3 Quilindschy Hartman DF 74;
     18 Hjalmar Ekdal DF 73; 6 Axel Tuanzebe DF 72; 23 Lucas Pires DF 72; 24 Josh Cullen MF 75; 16 Lesley Ugochukwu MF 74;
     29 Josh Laurent MF 73; 28 Hannibal Mejbri MF 74; 19 Zian Flemming FW 75; 11 Jaidon Anthony FW 74; 7 Loum Tchaouna FW 74;
     9 Lyle Foster FW 74; 27 Armando Broja FW 73`),
  T('CHE', 'Chelsea', 'CHE', ['#034694', null, '#034694', '#FFFFFF'], ['#F5F0E1', null, '#F5F0E1', '#F5F0E1'],
    `1 Robert Sánchez GK 79; 12 Filip Jørgensen GK 75; 24 Reece James DF 84; 6 Levi Colwill DF 82; 29 Wesley Fofana DF 80;
     4 Tosin Adarabioyo DF 78; 3 Marc Cucurella DF 82; 27 Malo Gusto DF 80; 21 Jorrel Hato DF 78; 5 Benoît Badiashile DF 77;
     25 Moisés Caicedo MF 87; 8 Enzo Fernández MF 85; 10 Cole Palmer MF 87; 45 Roméo Lavia MF 79; 7 Pedro Neto FW 82;
     20 João Pedro FW 82; 9 Liam Delap FW 79; 41 Estêvão FW 80; 11 Jamie Gittens FW 79; 49 Alejandro Garnacho FW 80`),
  T('CRY', 'Crystal Palace', 'CRY', ['#1B458F', '#C4122E', '#1B458F', '#1B458F'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `1 Dean Henderson GK 81; 44 Walter Benítez GK 76; 6 Marc Guéhi DF 83; 5 Maxence Lacroix DF 80; 26 Chris Richards DF 78;
     2 Daniel Muñoz DF 80; 3 Tyrick Mitchell DF 78; 17 Nathaniel Clyne DF 72; 20 Adam Wharton MF 81; 19 Will Hughes MF 75;
     18 Daichi Kamada MF 77; 8 Jefferson Lerma MF 76; 7 Ismaïla Sarr FW 80; 14 Jean-Philippe Mateta FW 81; 10 Yeremy Pino FW 79; 9 Eddie Nketiah FW 74`),
  T('EVE', 'Everton', 'EVE', ['#003399', null, '#FFFFFF', '#FFFFFF'], ['#F3F3F3', null, '#1B1B1B', '#F3F3F3'],
    `1 Jordan Pickford GK 83; 12 Mark Travers GK 72; 6 James Tarkowski DF 79; 32 Jarrad Branthwaite DF 80; 15 Jake O'Brien DF 76;
     16 Vitalii Mykolenko DF 77; 2 Nathan Patterson DF 73; 5 Michael Keane DF 75; 37 James Garner MF 77; 27 Idrissa Gueye MF 76;
     22 Kiernan Dewsbury-Hall MF 77; 18 Jack Grealish MF 80; 42 Tim Iroegbunam MF 73; 7 Dwight McNeil MF 76; 10 Iliman Ndiaye FW 79;
     9 Beto FW 75; 11 Thierno Barry FW 76`),
  T('FUL', 'Fulham', 'FUL', ['#FFFFFF', null, '#111111', '#FFFFFF'], ['#D2001F', null, '#D2001F', '#D2001F'],
    `1 Bernd Leno GK 81; 23 Benjamin Lecomte GK 72; 5 Joachim Andersen DF 79; 3 Calvin Bassey DF 77; 33 Antonee Robinson DF 79;
     2 Kenny Tete DF 76; 31 Issa Diop DF 75; 16 Sander Berge MF 77; 20 Saša Lukić MF 75; 18 Andreas Pereira MF 77; 17 Alex Iwobi MF 78;
     32 Emile Smith Rowe MF 77; 6 Harrison Reed MF 74; 8 Harry Wilson FW 78; 7 Raúl Jiménez FW 77; 9 Rodrigo Muniz FW 77; 11 Adama Traoré FW 76`),
  T('LEE', 'Leeds United', 'LEE', ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'], ['#1D428A', null, '#1D428A', '#FFCD00'],
    `1 Lucas Perri GK 76; 16 Illan Meslier GK 74; 6 Joe Rodon DF 76; 15 Jaka Bijol DF 77; 5 Pascal Struijk DF 75; 2 Jayden Bogle DF 75;
     3 Gabriel Gudmundsson DF 75; 23 Sebastiaan Bornauw DF 73; 4 Ethan Ampadu MF 76; 18 Anton Stach MF 77; 22 Ao Tanaka MF 76;
     8 Sean Longstaff MF 75; 11 Brenden Aaronson MF 74; 9 Dominic Calvert-Lewin FW 76; 10 Noah Okafor FW 76; 7 Daniel James FW 75;
     29 Wilfried Gnonto FW 74; 14 Lukas Nmecha FW 74`),
  T('LIV', 'Liverpool', 'LIV', ['#C8102E', null, '#C8102E', '#C8102E'], ['#F2F2F2', null, '#F2F2F2', '#F2F2F2'],
    `1 Alisson GK 88; 25 Giorgi Mamardashvili GK 80; 4 Virgil van Dijk DF 88; 5 Ibrahima Konaté DF 84; 30 Jeremie Frimpong DF 81;
     6 Milos Kerkez DF 80; 26 Andrew Robertson DF 80; 12 Conor Bradley DF 77; 2 Joe Gomez DF 77; 38 Ryan Gravenberch MF 85;
     10 Alexis Mac Allister MF 85; 7 Florian Wirtz MF 87; 8 Dominik Szoboszlai MF 85; 17 Curtis Jones MF 80; 11 Mohamed Salah FW 89;
     9 Alexander Isak FW 87; 22 Hugo Ekitiké FW 84; 18 Cody Gakpo FW 83; 14 Federico Chiesa FW 77`),
  T('MCI', 'Manchester City', 'MCI', ['#6CABDD', null, '#FFFFFF', '#6CABDD'], ['#1C2C5B', null, '#1C2C5B', '#1C2C5B'],
    `25 Gianluigi Donnarumma GK 88; 1 James Trafford GK 77; 3 Rúben Dias DF 86; 24 Joško Gvardiol DF 85; 5 John Stones DF 81;
     6 Nathan Aké DF 79; 45 Abdukodir Khusanov DF 77; 27 Matheus Nunes DF 79; 33 Nico O'Reilly DF 76; 16 Rodri MF 89;
     4 Tijjani Reijnders MF 84; 20 Bernardo Silva MF 85; 47 Phil Foden MF 85; 10 Rayan Cherki MF 82; 14 Nico González MF 79;
     9 Erling Haaland FW 91; 11 Jérémy Doku FW 83; 7 Omar Marmoush FW 82; 26 Savinho FW 80`),
  T('MUN', 'Manchester United', 'MUN', ['#DA291C', null, '#FFFFFF', '#111111'], ['#F5F0E1', null, '#F5F0E1', '#F5F0E1'],
    `31 Senne Lammens GK 77; 1 Altay Bayındır GK 74; 2 Diogo Dalot DF 80; 4 Matthijs de Ligt DF 81; 6 Lisandro Martínez DF 82;
     15 Leny Yoro DF 79; 5 Harry Maguire DF 78; 3 Noussair Mazraoui DF 78; 23 Luke Shaw DF 77; 13 Patrick Dorgu DF 76;
     8 Bruno Fernandes MF 86; 37 Kobbie Mainoo MF 79; 18 Casemiro MF 79; 25 Manuel Ugarte MF 78; 19 Bryan Mbeumo FW 83;
     10 Matheus Cunha FW 83; 30 Benjamin Šeško FW 81; 16 Amad Diallo FW 80`),
  T('NEW', 'Newcastle United', 'NEW', ['#FFFFFF', '#241F20', '#241F20', '#241F20'], ['#0072CE', null, '#0072CE', '#0072CE'],
    `1 Nick Pope GK 82; 32 Aaron Ramsdale GK 78; 4 Sven Botman DF 80; 12 Malick Thiaw DF 80; 5 Fabian Schär DF 79; 2 Kieran Trippier DF 78;
     20 Lewis Hall DF 78; 17 Tino Livramento DF 79; 33 Dan Burn DF 77; 39 Bruno Guimarães MF 86; 8 Sandro Tonali MF 84;
     7 Joelinton MF 81; 41 Jacob Ramsey MF 78; 28 Joe Willock MF 77; 10 Anthony Gordon FW 83; 27 Nick Woltemade FW 81;
     18 Yoane Wissa FW 80; 11 Harvey Barnes FW 79; 23 Jacob Murphy FW 78`),
  T('NFO', 'Nottingham Forest', 'NFO', ['#DD0000', null, '#FFFFFF', '#DD0000'], ['#FFFFFF', null, '#1B1B1B', '#FFFFFF'],
    `26 Matz Sels GK 81; 13 John Victor GK 73; 5 Murillo DF 82; 31 Nikola Milenković DF 81; 34 Ola Aina DF 79; 3 Neco Williams DF 77;
     37 Nicolò Savona DF 75; 24 Jair Cunha DF 72; 8 Elliot Anderson MF 82; 10 Morgan Gibbs-White MF 82; 12 Douglas Luiz MF 78;
     6 Ibrahim Sangaré MF 76; 16 Nicolás Domínguez MF 75; 11 Chris Wood FW 80; 14 Dan Ndoye FW 79; 7 Callum Hudson-Odoi FW 77;
     19 Igor Jesus FW 77; 21 Omari Hutchinson FW 77`),
  T('SUN', 'Sunderland', 'SUN', ['#EB172B', '#FFFFFF', '#111111', '#EB172B'], ['#1B1B1B', null, '#1B1B1B', '#1B1B1B'],
    `22 Robin Roefs GK 76; 1 Anthony Patterson GK 73; 5 Dan Ballard DF 75; 15 Omar Alderete DF 76; 17 Reinildo DF 75;
     20 Nordi Mukiele DF 77; 32 Trai Hume DF 74; 26 Arthur Masuaku DF 74; 34 Granit Xhaka MF 81; 27 Noah Sadiki MF 76;
     19 Habib Diarra MF 77; 28 Enzo Le Fée MF 77; 11 Chris Rigg MF 72; 24 Simon Adingra FW 77; 18 Wilson Isidor FW 76;
     7 Chemsdine Talbi FW 75; 12 Eliezer Mayenda FW 74; 25 Bertrand Traoré FW 74`),
  T('TOT', 'Tottenham Hotspur', 'TOT', ['#FFFFFF', null, '#132257', '#FFFFFF'], ['#132257', null, '#132257', '#132257'],
    `1 Guglielmo Vicario GK 83; 31 Antonín Kinský GK 74; 17 Cristian Romero DF 85; 37 Micky van de Ven DF 84; 23 Pedro Porro DF 81;
     13 Destiny Udogie DF 79; 4 Kevin Danso DF 78; 24 Djed Spence DF 77; 6 João Palhinha MF 82; 30 Rodrigo Bentancur MF 79;
     29 Pape Matar Sarr MF 79; 8 Yves Bissouma MF 77; 10 James Maddison MF 81; 7 Xavi Simons MF 83; 21 Dejan Kulusevski MF 81;
     20 Mohammed Kudus FW 82; 19 Dominic Solanke FW 80; 9 Richarlison FW 78; 22 Brennan Johnson FW 78; 11 Mathys Tel FW 76`),
  T('WHU', 'West Ham United', 'WHU', ['#7A263A', null, '#FFFFFF', '#7A263A'], ['#1BB1E7', null, '#1BB1E7', '#1BB1E7'],
    `23 Alphonse Areola GK 77; 1 Mads Hermansen GK 76; 3 Maximilian Kilman DF 77; 25 Jean-Clair Todibo DF 77; 29 Aaron Wan-Bissaka DF 77;
     15 Konstantinos Mavropanos DF 75; 12 El Hadji Malick Diouf DF 76; 2 Kyle Walker-Peters DF 75; 10 Lucas Paquetá MF 80;
     28 Tomáš Souček MF 77; 18 Mateus Fernandes MF 75; 24 Guido Rodríguez MF 76; 27 Soungoutou Magassa MF 74; 20 Jarrod Bowen FW 82;
     11 Niclas Füllkrug FW 76; 7 Crysencio Summerville FW 76; 9 Callum Wilson FW 74`),
  T('WOL', 'Wolverhampton', 'WOL', ['#FDB913', null, '#231F20', '#FDB913'], ['#231F20', null, '#231F20', '#231F20'],
    `1 José Sá GK 77; 25 Sam Johnstone GK 75; 24 Toti Gomes DF 75; 4 Santiago Bueno DF 74; 18 Emmanuel Agbadou DF 76; 3 Hugo Bueno DF 74;
     38 Jackson Tchatchoua DF 75; 14 Yerson Mosquera DF 74; 2 Matt Doherty DF 72; 8 João Gomes MF 79; 7 André MF 77;
     5 Marshall Munetsi MF 75; 27 Jean-Ricner Bellegarde MF 75; 16 Fer López MF 74; 9 Jørgen Strand Larsen FW 79;
     11 Hwang Hee-chan FW 75; 20 Tolu Arokodare FW 74; 21 Rodrigo Gomes FW 73`),
];

const CL_EXTRA = [
  T('RMA', 'Real Madrid', 'RMA', ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'], ['#1B1F3B', null, '#1B1F3B', '#1B1F3B'],
    `1 Thibaut Courtois GK 89; 13 Andriy Lunin GK 79; 12 Trent Alexander-Arnold DF 85; 3 Éder Militão DF 84; 22 Antonio Rüdiger DF 84;
     24 Dean Huijsen DF 82; 2 Dani Carvajal DF 83; 18 Álvaro Carreras DF 80; 20 Fran García DF 77; 14 Aurélien Tchouaméni MF 85;
     8 Federico Valverde MF 88; 5 Jude Bellingham MF 89; 6 Eduardo Camavinga MF 83; 15 Arda Güler MF 83; 21 Brahim Díaz MF 80;
     10 Kylian Mbappé FW 92; 7 Vinícius Júnior FW 90; 11 Rodrygo FW 84; 30 Franco Mastantuono FW 77; 16 Gonzalo García FW 75`),
  T('BAR', 'Barcelona', 'BAR', ['#A50044', '#004D98', '#004D98', '#A50044'], ['#F6D046', null, '#F6D046', '#F6D046'],
    `13 Joan García GK 83; 1 Marc-André ter Stegen GK 85; 23 Jules Koundé DF 85; 5 Pau Cubarsí DF 83; 4 Ronald Araújo DF 82;
     24 Eric García DF 79; 3 Alejandro Balde DF 82; 18 Gerard Martín DF 75; 8 Pedri MF 89; 21 Frenkie de Jong MF 86; 6 Gavi MF 82;
     20 Dani Olmo MF 84; 16 Fermín López MF 81; 17 Marc Casadó MF 78; 10 Lamine Yamal FW 91; 11 Raphinha FW 88;
     9 Robert Lewandowski FW 86; 14 Marcus Rashford FW 81; 7 Ferran Torres FW 80`),
  T('RBL', 'RB Leipzig', 'RBL', ['#FFFFFF', null, '#FFFFFF', '#DD0741'], ['#0C2043', null, '#0C2043', '#0C2043'],
    `1 Péter Gulácsi GK 79; 26 Maarten Vandevoordt GK 77; 4 Willi Orbán DF 81; 23 Castello Lukeba DF 80; 22 David Raum DF 79;
     17 Ridle Baku DF 78; 39 Benjamin Henrichs DF 77; 5 El Chadaille Bitshiabu DF 74; 24 Xaver Schlager MF 80; 13 Nicolas Seiwald MF 78;
     14 Christoph Baumgartner MF 80; 20 Assan Ouédraogo MF 76; 44 Kevin Kampl MF 75; 9 Johan Bakayoko FW 79; 7 Antonio Nusa FW 78;
     49 Yan Diomande FW 76; 40 Rômulo FW 75; 11 Conrad Harder FW 74`),
  T('BAY', 'Bayern Munich', 'BAY', ['#DC052D', null, '#DC052D', '#DC052D'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `1 Manuel Neuer GK 86; 26 Sven Ulreich GK 72; 2 Dayot Upamecano DF 84; 4 Jonathan Tah DF 84; 3 Kim Min-jae DF 83;
     19 Alphonso Davies DF 82; 44 Josip Stanišić DF 79; 27 Konrad Laimer DF 80; 22 Raphaël Guerreiro DF 78; 6 Joshua Kimmich MF 87;
     45 Aleksandar Pavlović MF 81; 8 Leon Goretzka MF 80; 10 Jamal Musiala MF 88; 17 Michael Olise FW 87; 9 Harry Kane FW 90;
     14 Luis Díaz FW 85; 7 Serge Gnabry FW 80; 11 Nicolas Jackson FW 79`),
  T('PSG', 'Paris Saint-Germain', 'PSG', ['#004170', '#DA291C', '#004170', '#004170'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `39 Lucas Chevalier GK 82; 30 Matvey Safonov GK 77; 2 Achraf Hakimi DF 87; 5 Marquinhos DF 85; 51 Willian Pacho DF 84;
     25 Nuno Mendes DF 86; 21 Lucas Hernández DF 79; 3 Illia Zabarnyi DF 80; 17 Vitinha MF 88; 87 João Neves MF 86; 8 Fabián Ruiz MF 84;
     33 Warren Zaïre-Emery MF 80; 19 Lee Kang-in MF 79; 10 Ousmane Dembélé FW 90; 7 Khvicha Kvaratskhelia FW 87; 14 Désiré Doué FW 84;
     29 Bradley Barcola FW 83; 9 Gonçalo Ramos FW 79`),
  T('INT', 'Inter', 'INT', ['#0068A8', '#1B1B1B', '#1B1B1B', '#1B1B1B'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `1 Yann Sommer GK 83; 13 Josep Martínez GK 76; 95 Alessandro Bastoni DF 86; 6 Stefan de Vrij DF 80; 15 Francesco Acerbi DF 79;
     31 Yann Bisseck DF 79; 32 Federico Dimarco DF 84; 2 Denzel Dumfries DF 82; 30 Carlos Augusto DF 77; 23 Nicolò Barella MF 86;
     20 Hakan Çalhanoğlu MF 85; 22 Henrikh Mkhitaryan MF 80; 16 Davide Frattesi MF 80; 7 Piotr Zieliński MF 79; 10 Lautaro Martínez FW 88;
     9 Marcus Thuram FW 84; 14 Ange-Yoan Bonny FW 77; 94 Pio Esposito FW 75`),
  T('JUV', 'Juventus', 'JUV', ['#FFFFFF', '#1B1B1B', '#FFFFFF', '#FFFFFF'], ['#F5D130', null, '#1B1B1B', '#F5D130'],
    `16 Michele Di Gregorio GK 80; 1 Mattia Perin GK 76; 3 Gleison Bremer DF 84; 4 Federico Gatti DF 79; 15 Pierre Kalulu DF 79;
     6 Lloyd Kelly DF 77; 27 Andrea Cambiaso DF 80; 32 Juan Cabal DF 75; 5 Manuel Locatelli MF 81; 19 Khéphren Thuram MF 81;
     8 Teun Koopmeiners MF 80; 22 Weston McKennie MF 78; 10 Kenan Yıldız FW 84; 7 Francisco Conceição FW 81; 30 Jonathan David FW 82;
     9 Dušan Vlahović FW 82; 11 Edon Zhegrova FW 79; 20 Loïs Openda FW 79`),
  T('BVB', 'Borussia Dortmund', 'BVB', ['#FDE100', null, '#111111', '#FDE100'], ['#1B1B1B', null, '#1B1B1B', '#1B1B1B'],
    `1 Gregor Kobel GK 85; 33 Alexander Meyer GK 72; 4 Nico Schlotterbeck DF 84; 3 Waldemar Anton DF 80; 25 Niklas Süle DF 77;
     26 Julian Ryerson DF 78; 2 Yan Couto DF 77; 24 Daniel Svensson DF 77; 5 Ramy Bensebaini DF 77; 8 Felix Nmecha MF 80;
     20 Marcel Sabitzer MF 79; 10 Julian Brandt MF 81; 7 Jobe Bellingham MF 78; 17 Carney Chukwuemeka MF 75; 9 Serhou Guirassy FW 85;
     27 Karim Adeyemi FW 80; 14 Maximilian Beier FW 79`),
  T('ATM', 'Atlético Madrid', 'ATM', ['#CB3524', '#FFFFFF', '#272E61', '#CB3524'], ['#272E61', null, '#272E61', '#272E61'],
    `13 Jan Oblak GK 87; 1 Juan Musso GK 76; 2 José María Giménez DF 81; 24 Robin Le Normand DF 81; 17 David Hancko DF 81;
     16 Nahuel Molina DF 79; 3 Matteo Ruggeri DF 77; 18 Marc Pubill DF 76; 15 Clément Lenglet DF 77; 5 Johnny Cardoso MF 79; 6 Koke MF 81;
     8 Pablo Barrios MF 81; 4 Conor Gallagher MF 80; 10 Álex Baena MF 83; 11 Thiago Almada MF 80; 19 Julián Álvarez FW 87;
     7 Antoine Griezmann FW 84; 9 Alexander Sørloth FW 80; 20 Giuliano Simeone FW 79; 23 Nico González FW 78`),
  T('MIL', 'AC Milan', 'MIL', ['#FB090B', '#1B1B1B', '#FFFFFF', '#1B1B1B'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `16 Mike Maignan GK 86; 1 Pietro Terracciano GK 72; 23 Fikayo Tomori DF 80; 31 Strahinja Pavlović DF 79; 46 Matteo Gabbia DF 78;
     5 Koni De Winter DF 77; 2 Pervis Estupiñán DF 78; 33 Davide Bartesaghi DF 74; 24 Zachary Athekame DF 74; 14 Luka Modrić MF 84;
     12 Adrien Rabiot MF 82; 19 Youssouf Fofana MF 80; 4 Samuele Ricci MF 79; 56 Alexis Saelemaekers MF 79; 8 Ruben Loftus-Cheek MF 78;
     10 Rafael Leão FW 85; 11 Christian Pulisic FW 84; 18 Christopher Nkunku FW 80; 7 Santiago Giménez FW 79`),
  T('NAP', 'Napoli', 'NAP', ['#12A0D7', null, '#FFFFFF', '#12A0D7'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `32 Vanja Milinković-Savić GK 79; 1 Alex Meret GK 80; 22 Giovanni Di Lorenzo DF 83; 13 Amir Rrahmani DF 81; 4 Alessandro Buongiorno DF 82;
     31 Sam Beukema DF 79; 17 Mathías Olivera DF 78; 37 Leonardo Spinazzola DF 76; 68 Stanislav Lobotka MF 84; 8 Scott McTominay MF 86;
     11 Kevin De Bruyne MF 86; 99 Frank Anguissa MF 81; 6 Billy Gilmour MF 78; 19 Rasmus Højlund FW 80; 9 Romelu Lukaku FW 81;
     7 David Neres FW 80; 21 Matteo Politano FW 79; 70 Noa Lang FW 79`),
  T('BEN', 'Benfica', 'BEN', ['#E83030', null, '#FFFFFF', '#E83030'], ['#1B1B1B', null, '#1B1B1B', '#1B1B1B'],
    `1 Anatoliy Trubin GK 82; 24 Samuel Soares GK 70; 4 António Silva DF 81; 30 Nicolás Otamendi DF 80; 44 Tomás Araújo DF 79;
     17 Amar Dedić DF 78; 26 Samuel Dahl DF 76; 8 Fredrik Aursnes MF 80; 20 Richard Ríos MF 79; 5 Enzo Barrenechea MF 77;
     10 Georgiy Sudakov MF 80; 18 Leandro Barreiro MF 77; 14 Vangelis Pavlidis FW 81; 11 Dodi Lukébakio FW 78; 9 Franjo Ivanović FW 76;
     21 Andreas Schjelderup FW 76; 25 Gianluca Prestianni FW 75`),
];

export const NATIONS = [
  T('ARG', 'Argentina', 'ARG', ['#75AADB', '#FFFFFF', '#1B1B1B', '#FFFFFF'], ['#1B2A5A', null, '#1B2A5A', '#1B2A5A'],
    `23 Emiliano Martínez GK 86; 12 Gerónimo Rulli GK 78; 13 Cristian Romero DF 85; 25 Lisandro Martínez DF 82; 19 Nicolás Otamendi DF 80;
     26 Nahuel Molina DF 79; 3 Nicolás Tagliafico DF 78; 6 Leonardo Balerdi DF 78; 24 Enzo Fernández MF 85; 20 Alexis Mac Allister MF 85;
     7 Rodrigo De Paul MF 82; 5 Leandro Paredes MF 79; 16 Thiago Almada MF 80; 11 Giovani Lo Celso MF 79; 10 Lionel Messi FW 88;
     9 Julián Álvarez FW 87; 22 Lautaro Martínez FW 88; 15 Nico González FW 78`),
  T('BRA', 'Brazil', 'BRA', ['#FFDC02', null, '#1B47C4', '#FFFFFF'], ['#1B47C4', null, '#FFFFFF', '#1B47C4'],
    `1 Alisson GK 88; 23 Ederson GK 84; 4 Marquinhos DF 85; 3 Gabriel Magalhães DF 87; 14 Éder Militão DF 84; 2 Wesley DF 77;
     16 Douglas Santos DF 76; 6 Alex Sandro DF 75; 8 Bruno Guimarães MF 86; 5 Casemiro MF 79; 20 Lucas Paquetá MF 80; 15 Andrey Santos MF 77;
     7 Vinícius Júnior FW 90; 11 Raphinha FW 88; 10 Rodrygo FW 84; 9 Matheus Cunha FW 83; 18 Estêvão FW 80; 22 Gabriel Martinelli FW 82`),
  T('FRA', 'France', 'FRA', ['#1B2C6B', null, '#FFFFFF', '#D62D3A'], ['#FFFFFF', null, '#1B2C6B', '#FFFFFF'],
    `16 Mike Maignan GK 86; 23 Lucas Chevalier GK 82; 17 William Saliba DF 88; 5 Jules Koundé DF 85; 4 Dayot Upamecano DF 84;
     24 Ibrahima Konaté DF 84; 22 Théo Hernandez DF 81; 2 Malo Gusto DF 80; 8 Aurélien Tchouaméni MF 85; 14 Adrien Rabiot MF 82;
     6 Manu Koné MF 82; 25 Rayan Cherki MF 82; 13 N'Golo Kanté MF 78; 10 Kylian Mbappé FW 92; 7 Ousmane Dembélé FW 90;
     11 Michael Olise FW 87; 20 Désiré Doué FW 84; 15 Bradley Barcola FW 83`),
  T('ENG', 'England', 'ENG', ['#FFFFFF', null, '#1B2C6B', '#FFFFFF'], ['#C8102E', null, '#C8102E', '#C8102E'],
    `1 Jordan Pickford GK 83; 13 Dean Henderson GK 81; 2 Reece James DF 84; 6 Marc Guéhi DF 83; 5 John Stones DF 81; 15 Ezri Konsa DF 81;
     3 Myles Lewis-Skelly DF 77; 12 Tino Livramento DF 79; 4 Declan Rice MF 88; 10 Jude Bellingham MF 89; 8 Elliot Anderson MF 82;
     11 Phil Foden MF 85; 16 Eberechi Eze MF 84; 20 Morgan Rogers MF 83; 9 Harry Kane FW 90; 7 Bukayo Saka FW 88; 18 Anthony Gordon FW 83`),
  T('ESP', 'Spain', 'ESP', ['#C8102E', null, '#13235B', '#C8102E'], ['#F5F0E1', null, '#F5F0E1', '#F5F0E1'],
    `23 Unai Simón GK 85; 1 David Raya GK 86; 2 Dani Carvajal DF 83; 5 Pau Cubarsí DF 83; 4 Dean Huijsen DF 82; 14 Aymeric Laporte DF 80;
     24 Marc Cucurella DF 82; 12 Pedro Porro DF 81; 16 Rodri MF 89; 20 Pedri MF 89; 18 Martín Zubimendi MF 86; 8 Fabián Ruiz MF 84;
     6 Mikel Merino MF 82; 10 Dani Olmo MF 84; 19 Lamine Yamal FW 91; 17 Nico Williams FW 85; 21 Mikel Oyarzabal FW 82; 7 Álvaro Morata FW 78`),
  T('GER', 'Germany', 'GER', ['#FFFFFF', null, '#1B1B1B', '#FFFFFF'], ['#7A2C8C', null, '#7A2C8C', '#7A2C8C'],
    `1 Marc-André ter Stegen GK 85; 12 Oliver Baumann GK 79; 6 Joshua Kimmich DF 87; 2 Antonio Rüdiger DF 84; 4 Jonathan Tah DF 84;
     15 Nico Schlotterbeck DF 84; 3 David Raum DF 79; 18 Maximilian Mittelstädt DF 77; 10 Jamal Musiala MF 88; 17 Florian Wirtz MF 87;
     5 Aleksandar Pavlović MF 81; 8 Leon Goretzka MF 80; 23 Robert Andrich MF 78; 7 Kai Havertz FW 82; 19 Leroy Sané FW 82;
     11 Nick Woltemade FW 81; 9 Serge Gnabry FW 80; 13 Karim Adeyemi FW 80`),
  T('POR', 'Portugal', 'POR', ['#A8102A', null, '#0D5C2E', '#A8102A'], ['#F5F0E1', null, '#F5F0E1', '#F5F0E1'],
    `1 Diogo Costa GK 85; 12 José Sá GK 77; 3 Rúben Dias DF 86; 4 Gonçalo Inácio DF 83; 19 Nuno Mendes DF 86; 20 João Cancelo DF 82;
     2 Nélson Semedo DF 78; 13 Renato Veiga DF 77; 23 Vitinha MF 88; 15 João Neves MF 86; 8 Bruno Fernandes MF 86; 10 Bernardo Silva MF 85;
     7 Cristiano Ronaldo FW 84; 17 Rafael Leão FW 85; 18 Pedro Neto FW 82; 11 João Félix FW 79; 9 Gonçalo Ramos FW 79`),
  T('NED', 'Netherlands', 'NED', ['#FF6B00', null, '#FF6B00', '#FF6B00'], ['#1B2C6B', null, '#1B2C6B', '#1B2C6B'],
    `1 Bart Verbruggen GK 80; 13 Mark Flekken GK 77; 4 Virgil van Dijk DF 88; 15 Micky van de Ven DF 84; 22 Denzel Dumfries DF 82;
     12 Jurriën Timber DF 83; 3 Matthijs de Ligt DF 81; 6 Jan Paul van Hecke DF 80; 5 Nathan Aké DF 79; 21 Frenkie de Jong MF 86;
     8 Ryan Gravenberch MF 85; 14 Tijjani Reijnders MF 84; 7 Xavi Simons MF 83; 20 Teun Koopmeiners MF 80; 11 Cody Gakpo FW 83;
     10 Memphis Depay FW 80; 18 Donyell Malen FW 79; 9 Brian Brobbey FW 77`),
  T('BEL', 'Belgium', 'BEL', ['#C8102E', null, '#C8102E', '#C8102E'], ['#F5F0E1', null, '#F5F0E1', '#F5F0E1'],
    `1 Thibaut Courtois GK 89; 13 Koen Casteels GK 77; 2 Zeno Debast DF 78; 3 Arthur Theate DF 78; 4 Wout Faes DF 76;
     21 Timothy Castagne DF 77; 16 Maxim De Cuyper DF 77; 15 Thomas Meunier DF 74; 7 Kevin De Bruyne MF 86; 8 Youri Tielemans MF 82;
     24 Amadou Onana MF 80; 6 Axel Witsel MF 74; 11 Jérémy Doku FW 83; 10 Romelu Lukaku FW 81; 19 Leandro Trossard FW 81;
     17 Charles De Ketelaere FW 80; 20 Loïs Openda FW 79`),
  T('CRO', 'Croatia', 'CRO', ['#FFFFFF', '#E30613', '#1B2C6B', '#1B2C6B'], ['#1B2C6B', null, '#1B2C6B', '#1B2C6B'],
    `1 Dominik Livaković GK 81; 12 Ivica Ivušić GK 72; 4 Joško Gvardiol DF 85; 2 Josip Stanišić DF 79; 3 Josip Šutalo DF 78;
     6 Duje Ćaleta-Car DF 76; 21 Borna Sosa DF 74; 10 Luka Modrić MF 84; 8 Mateo Kovačić MF 82; 15 Mario Pašalić MF 78;
     18 Petar Sučić MF 77; 13 Nikola Vlašić MF 77; 7 Lovro Majer MF 77; 11 Martin Baturina MF 77; 9 Andrej Kramarić FW 79;
     14 Ivan Perišić FW 77; 16 Ante Budimir FW 76`),
  T('URU', 'Uruguay', 'URU', ['#7AC4F0', null, '#1B1B1B', '#1B1B1B'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `1 Sergio Rochet GK 77; 23 Santiago Mele GK 75; 4 Ronald Araújo DF 82; 2 José María Giménez DF 81; 16 Mathías Olivera DF 78;
     13 Guillermo Varela DF 75; 3 Sebastián Cáceres DF 75; 15 Federico Valverde MF 88; 6 Rodrigo Bentancur MF 79; 5 Manuel Ugarte MF 78;
     10 Giorgian de Arrascaeta MF 80; 8 Nicolás de la Cruz MF 78; 19 Darwin Núñez FW 81; 20 Maximiliano Araújo FW 77;
     11 Facundo Pellistri FW 76; 9 Rodrigo Aguirre FW 74`),
  T('USA', 'USA', 'USA', ['#FFFFFF', null, '#1B2C6B', '#FFFFFF'], ['#1B2C6B', null, '#1B2C6B', '#1B2C6B'],
    `1 Matt Turner GK 75; 24 Matt Freese GK 74; 3 Chris Richards DF 78; 5 Antonee Robinson DF 79; 2 Sergiño Dest DF 77;
     12 Miles Robinson DF 74; 13 Tim Ream DF 73; 4 Tyler Adams MF 77; 8 Weston McKennie MF 78; 6 Johnny Cardoso MF 79;
     17 Malik Tillman MF 77; 7 Giovanni Reyna MF 76; 10 Christian Pulisic FW 84; 20 Folarin Balogun FW 78; 21 Timothy Weah FW 76;
     9 Ricardo Pepi FW 75`),
  T('MEX', 'Mexico', 'MEX', ['#0B6B3A', null, '#FFFFFF', '#C8102E'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `1 Luis Malagón GK 75; 13 Guillermo Ochoa GK 74; 5 Johan Vásquez DF 77; 3 César Montes DF 76; 2 Jorge Sánchez DF 73;
     23 Jesús Gallardo DF 73; 19 Israel Reyes DF 73; 4 Edson Álvarez MF 79; 24 Luis Chávez MF 76; 17 Orbelín Pineda MF 75; 7 Luis Romo MF 74;
     11 Santiago Giménez FW 79; 9 Raúl Jiménez FW 77; 22 Hirving Lozano FW 77; 10 Alexis Vega FW 75; 16 Julián Quiñones FW 75`),
  T('JPN', 'Japan', 'JPN', ['#0B2A7A', null, '#FFFFFF', '#0B2A7A'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `1 Zion Suzuki GK 78; 12 Keisuke Osako GK 70; 21 Hiroki Itō DF 78; 16 Takehiro Tomiyasu DF 77; 4 Kō Itakura DF 77;
     2 Yukinari Sugawara DF 76; 3 Shōgo Taniguchi DF 74; 6 Wataru Endō MF 78; 13 Hidemasa Morita MF 77; 15 Daichi Kamada MF 77;
     8 Takumi Minamino MF 78; 20 Takefusa Kubo FW 82; 7 Kaoru Mitoma FW 81; 10 Ritsu Dōan FW 78; 14 Junya Itō FW 77; 9 Ayase Ueda FW 77`),
  T('MAR', 'Morocco', 'MAR', ['#C1272D', null, '#0B7A3A', '#C1272D'], ['#FFFFFF', null, '#FFFFFF', '#FFFFFF'],
    `1 Yassine Bounou GK 84; 12 Munir Mohamedi GK 72; 2 Achraf Hakimi DF 87; 5 Nayef Aguerd DF 79; 3 Noussair Mazraoui DF 78;
     6 Romain Saïss DF 74; 18 Jawad El Yamiq DF 72; 4 Sofyan Amrabat MF 77; 8 Azzedine Ounahi MF 77; 10 Brahim Díaz MF 80;
     11 Bilal El Khannouss MF 76; 21 Eliesse Ben Seghir MF 76; 7 Hakim Ziyech MF 76; 19 Youssef En-Nesyri FW 78; 17 Abde Ezzalzouli FW 78;
     20 Ayoub El Kaabi FW 76`),
  T('ISL', 'Iceland', 'ISL', ['#1D4FD8', null, '#FFFFFF', '#1D4FD8'], ['#FFFFFF', null, '#1D4FD8', '#FFFFFF'],
    `1 Hákon Rafn Valdimarsson GK 72; 12 Elías Rafn Ólafsson GK 70; 5 Sverrir Ingi Ingason DF 73; 4 Daníel Leó Grétarsson DF 70;
     23 Valgeir Lunddal Friðriksson DF 70; 2 Alfons Sampsted DF 69; 3 Guðlaugur Victor Pálsson DF 70; 6 Hjörtur Hermannsson DF 69;
     11 Hákon Arnar Haraldsson MF 77; 14 Ísak Bergmann Jóhannesson MF 74; 8 Arnór Ingvi Traustason MF 70; 7 Jóhann Berg Guðmundsson MF 71;
     16 Stefán Teitur Þórðarson MF 70; 17 Mikael Egill Ellertsson MF 70; 10 Albert Guðmundsson FW 79; 9 Orri Steinn Óskarsson FW 75;
     22 Andri Lucas Guðjohnsen FW 72; 21 Jón Dagur Þorsteinsson FW 71`),
];

const PL_IN_CL = ['ARS', 'CHE', 'LIV', 'MCI'];
export const CHAMPIONS_LEAGUE = [...CL_EXTRA, ...PREMIER_LEAGUE.filter((t) => PL_IN_CL.includes(t.id))];
export const CLUBS = [...CL_EXTRA, ...PREMIER_LEAGUE];
export const ALL_TEAMS = [...CLUBS, ...NATIONS];

const BY_ID = new Map(ALL_TEAMS.map((t) => [t.id, t]));
export const teamById = (id) => BY_ID.get(id);

/** Overall rating: average of the best XI in a 4-3-3. */
export function teamRating(t) {
  const xi = defaultLineup(t, '4-3-3').xi.map((i) => t.squad[i].r);
  return Math.round(xi.reduce((a, b) => a + b, 0) / xi.length);
}

export function stars(t) {
  const r = teamRating(t);
  return Math.max(1, Math.min(5, Math.round((r - 68) / 4)));
}

// Formations: slots as [lateral -1..1 (left..right), depth 0..1 (own goal..opponent goal), role].
export const FORMATIONS = {
  '4-3-3': [[0, 0, 'GK'], [-0.8, 0.22, 'DF'], [-0.28, 0.17, 'DF'], [0.28, 0.17, 'DF'], [0.8, 0.22, 'DF'],
    [-0.45, 0.45, 'MF'], [0, 0.38, 'MF'], [0.45, 0.45, 'MF'], [-0.75, 0.74, 'FW'], [0, 0.8, 'FW'], [0.75, 0.74, 'FW']],
  '4-4-2': [[0, 0, 'GK'], [-0.8, 0.22, 'DF'], [-0.28, 0.17, 'DF'], [0.28, 0.17, 'DF'], [0.8, 0.22, 'DF'],
    [-0.78, 0.48, 'MF'], [-0.26, 0.43, 'MF'], [0.26, 0.43, 'MF'], [0.78, 0.48, 'MF'], [-0.25, 0.78, 'FW'], [0.25, 0.78, 'FW']],
  '4-2-3-1': [[0, 0, 'GK'], [-0.8, 0.22, 'DF'], [-0.28, 0.17, 'DF'], [0.28, 0.17, 'DF'], [0.8, 0.22, 'DF'],
    [-0.3, 0.38, 'MF'], [0.3, 0.38, 'MF'], [-0.72, 0.62, 'MF'], [0, 0.6, 'MF'], [0.72, 0.62, 'MF'], [0, 0.82, 'FW']],
  '3-5-2': [[0, 0, 'GK'], [-0.5, 0.18, 'DF'], [0, 0.15, 'DF'], [0.5, 0.18, 'DF'],
    [-0.85, 0.48, 'MF'], [-0.35, 0.42, 'MF'], [0, 0.36, 'MF'], [0.35, 0.42, 'MF'], [0.85, 0.48, 'MF'], [-0.25, 0.78, 'FW'], [0.25, 0.78, 'FW']],
};

/** Pick the best XI for a formation. Returns { formation, xi: [squad indices in slot order] }. */
export function defaultLineup(t, formation = '4-3-3') {
  const slots = FORMATIONS[formation];
  const used = new Set(), xi = [];
  const pick = (role) => {
    let best = -1;
    t.squad.forEach((p, i) => { if (!used.has(i) && p.pos === role && (best < 0 || p.r > t.squad[best].r)) best = i; });
    if (best < 0) t.squad.forEach((p, i) => { if (!used.has(i) && p.pos !== 'GK' && (best < 0 || p.r > t.squad[best].r)) best = i; });
    used.add(best);
    return best;
  };
  for (const s of slots) xi.push(pick(s[2]));
  return { formation, xi };
}

/** Rough perceptual distance between two hex colours. */
function colorDist(a, b) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  return Math.hypot(r1 - r2, (g1 - g2) * 1.2, b1 - b2);
}

/** Kits for a match: the away team switches kit when shirts clash. */
export function matchKits(home, away) {
  let ak = away.home;
  if (colorDist(home.home[0], ak[0]) < 120 || colorDist(home.home[2], ak[2]) < 40 && colorDist(home.home[0], ak[0]) < 160) ak = away.away;
  if (colorDist(home.home[0], ak[0]) < 120) ak = ['#222222', null, '#222222', '#222222'];
  return [home.home, ak];
}
