const hotelData = {
    // Tamil Nadu Hotels
    'Chennai': {
        budget: [
            { name: "Hotel ibis Chennai City Centre", price: 2500, rating: 4.2, link: "https://www.booking.com/hotel/in/ibis-chennai-city-centre.html" },
            { name: "The Residency", price: 3200, rating: 4.5, link: "https://www.booking.com/hotel/in/the-residency-chennai.html" },
            { name: "Hotel Brown", price: 1800, rating: 3.8, link: "https://www.booking.com/hotel/in/brown.html" }
        ],
        premium: [
            { name: "The Leela Palace Chennai", price: 12000, rating: 4.9, link: "https://www.booking.com/hotel/in/the-leela-palace-chennai.html" },
            { name: "Taj Coromandel", price: 15000, rating: 4.8, link: "https://www.booking.com/hotel/in/taj-coromandel-chennai.html" },
            { name: "ITC Grand Chola", price: 11000, rating: 4.7, link: "https://www.booking.com/hotel/in/itc-grand-chola.html" }
        ],
        luxury: [
            { name: "Taj Fisherman's Cove", price: 25000, rating: 4.9, link: "https://www.booking.com/hotel/in/taj-fishermans-cove.html" },
            { name: "The Leela Palace", price: 22000, rating: 4.8, link: "https://www.booking.com/hotel/in/the-leela-palace-chennai.html" }
        ]
    },
    'Madurai': {
        budget: [
            { name: "Hotel Supreme", price: 1500, rating: 3.5, link: "https://www.booking.com/hotel/in/hotel-supreme-madurai.html" },
            { name: "Madurai Residency", price: 1200, rating: 3.8, link: "https://www.booking.com/hotel/in/madurai-residency.html" }
        ],
        premium: [
            { name: "Heritage Inn Madurai", price: 4500, rating: 4.3, link: "https://www.booking.com/hotel/in/heritage-inn-madurai.html" },
            { name: "The Golden Fort", price: 3800, rating: 4.2, link: "https://www.booking.com/hotel/in/the-golden-fort.html" }
        ],
        luxury: [
            { name: "Taj Madurai", price: 8000, rating: 4.6, link: "https://www.booking.com/hotel/in/taj-madurai.html" }
        ]
    },
    'Coimbatore': {
        budget: [
            { name: "Hotel檀香", price: 1800, rating: 3.9, link: "https://www.booking.com/hotel/in/hotel-sandalwood.html" },
            { name: "Zone by The Park", price: 2500, rating: 4.1, link: "https://www.booking.com/hotel/in/zone-by-the-park-coimbatore.html" }
        ],
        premium: [
            { name: "The Residency Towers", price: 5500, rating: 4.5, link: "https://www.booking.com/hotel/in/the-residency-towers-coimbatore.html" },
            { name: "Vivanta Coimbatore", price: 6000, rating: 4.4, link: "https://www.booking.com/hotel/in/vivanta-coimbatore.html" }
        ],
        luxury: []
    },
    'Ooty': {
        budget: [
            { name: "Hotel Lake View", price: 2000, rating: 3.8, link: "https://www.booking.com/hotel/in/hotel-lake-view-ooty.html" },
            { name: "Silver Cloud Hotel", price: 2200, rating: 4.0, link: "https://www.booking.com/hotel/in/silver-cloud-hotel.html" }
        ],
        premium: [
            { name: "The Fern Hill", price: 5500, rating: 4.5, link: "https://www.booking.com/hotel/in/the-fern-hill.html" },
            { name: "King's Cliff", price: 4800, rating: 4.3, link: "https://www.booking.com/hotel/in/kings-cliff.html" }
        ],
        luxury: [
            { name: "Taj Savoy Hotel", price: 12000, rating: 4.8, link: "https://www.booking.com/hotel/in/taj-savoy-ooty.html" },
            { name: "Wildflower Resort", price: 9000, rating: 4.6, link: "https://www.booking.com/hotel/in/wildflower-resort.html" }
        ]
    },
    'Kanyakumari': {
        budget: [
            { name: "Hotel Sarovar", price: 1200, rating: 3.5, link: "https://www.booking.com/hotel/in/hotel-sarovar-kanyakumari.html" },
            { name: "Sea View Hotel", price: 1500, rating: 3.7, link: "https://www.booking.com/hotel/in/sea-view-hotel.html" }
        ],
        premium: [
            { name: "The Travor", price: 3500, rating: 4.2, link: "https://www.booking.com/hotel/in/the-travor.html" },
            { name: "Hotel Gnan", price: 2800, rating: 4.0, link: "https://www.booking.com/hotel/in/hotel-gnan.html" }
        ],
        luxury: [
            { name: "Taj Nataraj", price: 7000, rating: 4.7, link: "https://www.booking.com/hotel/in/taj-nataraj.html" }
        ]
    },
    // International
    'Paris': {
        budget: [
            { name: "Hotel Marais", price: 8000, rating: 3.9, link: "https://www.booking.com/hotel/fr/hotel-le-marais.html" },
            { name: "Ibis Paris Centre", price: 9000, rating: 4.0, link: "https://www.booking.com/hotel/fr/ibis-paris-centre.html" }
        ],
        premium: [
            { name: "Hotel Le Marais", price: 15000, rating: 4.4, link: "https://www.booking.com/hotel/fr/hotel-le-marais.html" },
            { name: "Citadines Les Halles", price: 12000, rating: 4.3, link: "https://www.booking.com/hotel/fr/citadines-les-halles.html" }
        ],
        luxury: [
            { name: "Four Seasons George V", price: 80000, rating: 4.9, link: "https://www.booking.com/hotel/fr/four-seasons-george-v.html" },
            { name: "Plaza Athenee", price: 65000, rating: 4.8, link: "https://www.booking.com/hotel/fr/plaza-athenee.html" }
        ]
    },
    'New York': {
        budget: [
            { name: "Pod Times Square", price: 6000, rating: 4.1, link: "https://www.booking.com/hotel/us/pod-times-square.html" },
            { name: "IATA City Hall", price: 5500, rating: 3.9, link: "https://www.booking.com/hotel/us/the-hall-of-charts.html" }
        ],
        premium: [
            { name: "The Manhattan at Times Square", price: 15000, rating: 4.3, link: "https://www.booking.com/hotel/us/the-manhattan-at-times-square.html" },
            { name: "Pod 51", price: 8000, rating: 4.0, link: "https://www.booking.com/hotel/us/pod-51.html" }
        ],
        luxury: [
            { name: "The Plaza", price: 85000, rating: 4.9, link: "https://www.booking.com/hotel/us/the-plaza.html" },
            { name: "The St. Regis New York", price: 70000, rating: 4.8, link: "https://www.booking.com/hotel/us/the-st-regis-new-york.html" }
        ]
    },
    'Singapore': {
        budget: [
            { name: "Hotel 81", price: 5000, rating: 3.8, link: "https://www.booking.com/hotel/sg/hotel-81.html" },
            { name: "Vintage Capsules", price: 4500, rating: 4.0, link: "https://www.booking.com/hotel/sg/vintage-capsules.html" }
        ],
        premium: [
            { name: "PARKROYAL on Beach Road", price: 12000, rating: 4.4, link: "https://www.booking.com/hotel/sg/parkroyal-on-beach-road.html" },
            { name: "Oasia Hotel Downtown", price: 11000, rating: 4.5, link: "https://www.booking.com/hotel/sg/oasia-hotel-downtown.html" }
        ],
        luxury: [
            { name: "Marina Bay Sands", price: 45000, rating: 4.8, link: "https://www.booking.com/hotel/sg/marina-bay-sands.html" },
            { name: "Raffles Hotel", price: 55000, rating: 4.9, link: "https://www.booking.com/hotel/sg/raffles.html" }
        ]
    },
    'Bangkok': {
        budget: [
            { name: "Ibis Bangkok Siam", price: 2500, rating: 4.0, link: "https://www.booking.com/hotel/th/ibis-bangkok-siam.html" },
            { name: "Dream Hotel", price: 3000, rating: 4.2, link: "https://www.booking.com/hotel/th/dream-bangkok.html" }
        ],
        premium: [
            { name: "Anantara Riverside", price: 6500, rating: 4.5, link: "https://www.booking.com/hotel/th/anantara-riverside-bangkok.html" },
            { name: "Siam Kempinski", price: 8000, rating: 4.7, link: "https://www.booking.com/hotel/th/siam-kempinski.html" }
        ],
        luxury: [
            { name: "The Peninsula Bangkok", price: 25000, rating: 4.9, link: "https://www.booking.com/hotel/th/the-peninsula-bangkok.html" },
            { name: "Mandarin Oriental", price: 30000, rating: 4.9, link: "https://www.booking.com/hotel/th/mandarin-oriental-bangkok.html" }
        ]
    },
    'Dubai': {
        budget: [
            { name: "Ibis Dubai Mall", price: 4500, rating: 4.1, link: "https://www.booking.com/hotel/ae/ibis-dubai-mall.html" },
            { name: "Rove Downtown", price: 5000, rating: 4.3, link: "https://www.booking.com/hotel/ae/rove-downtown.html" }
        ],
        premium: [
            { name: "Jumeirah Beach Hotel", price: 18000, rating: 4.7, link: "https://www.booking.com/hotel/ae/jumeirah-beach-hotel.html" },
            { name: "Atlantis The Palm", price: 22000, rating: 4.8, link: "https://www.booking.com/hotel/ae/atlantis-the-palm.html" }
        ],
        luxury: [
            { name: "Burj Al Arab", price: 85000, rating: 4.9, link: "https://www.booking.com/hotel/ae/burj-al-arab.html" },
            { name: "Emirates Towers", price: 35000, rating: 4.7, link: "https://www.booking.com/hotel/ae/emirates-towers.html" }
        ]
    },
    'Berlin': {
        budget: [
            { name: "A&O Hostel", price: 4000, rating: 4.0, link: "https://www.booking.com/hotel/de/a-o-berlin.html" },
            { name: "Ibis Berlin Mitte", price: 5000, rating: 4.2, link: "https://www.booking.com/hotel/de/ibis-berlin-mitte.html" }
        ],
        premium: [
            { name: "Hotel Adlon", price: 15000, rating: 4.6, link: "https://www.booking.com/hotel/de/hotel-adlon.html" },
            { name: "The Westin", price: 12000, rating: 4.5, link: "https://www.booking.com/hotel/de/the-westin-grand-berlin.html" }
        ],
        luxury: [
            { name: "Hotel de Rome", price: 25000, rating: 4.8, link: "https://www.booking.com/hotel/de/hotel-de-rome.html" },
            { name: "Ritz-Carlton", price: 30000, rating: 4.9, link: "https://www.booking.com/hotel/de/ritz-carlton-berlin.html" }
        ]
    },
    'San Francisco': {
        budget: [
            { name: "Hotel VIA", price: 6000, rating: 4.0, link: "https://www.booking.com/hotel/us/hotel-via.html" },
            { name: "Good Hotel", price: 6500, rating: 4.1, link: "https://www.booking.com/hotel/us/good-hotel-san-francisco.html" }
        ],
        premium: [
            { name: "Fairmont", price: 15000, rating: 4.5, link: "https://www.booking.com/hotel/us/fairmont-san-francisco.html" },
            { name: "InterContinental", price: 12000, rating: 4.4, link: "https://www.booking.com/hotel/us/intercontinental-san-francisco.html" }
        ],
        luxury: [
            { name: "The Ritz-Carlton", price: 35000, rating: 4.8, link: "https://www.booking.com/hotel/us/ritz-carlton-san-francisco.html" },
            { name: "Four Seasons", price: 40000, rating: 4.9, link: "https://www.booking.com/hotel/us/four-seasons-san-francisco.html" }
        ]
    },
    'London': {
        budget: [
            { name: "Premier Inn", price: 5000, rating: 4.2, link: "https://www.booking.com/hotel/gb/premier-inn-london.html" },
            { name: "YHA London", price: 4500, rating: 4.0, link: "https://www.booking.com/hotel/gb/yha-london-central.html" }
        ],
        premium: [
            { name: "The Savoy", price: 25000, rating: 4.7, link: "https://www.booking.com/hotel/gb/savoy.html" },
            { name: "The Langham", price: 20000, rating: 4.6, link: "https://www.booking.com/hotel/gb/thelangham.html" }
        ],
        luxury: [
            { name: "The Ritz", price: 45000, rating: 4.9, link: "https://www.booking.com/hotel/gb/ritz.html" },
            { name: "Claridges", price: 40000, rating: 4.8, link: "https://www.booking.com/hotel/gb/claridges.html" }
        ]
    },
    'Tokyo': {
        budget: [
            { name: "Capsule Hotel", price: 3500, rating: 4.0, link: "https://www.booking.com/hotel/jp/capsule-hotel-tokyo.html" },
            { name: "N問Business Hotel", price: 5000, rating: 4.1, link: "https://www.booking.com/hotel/jp/n问business-hotel.html" }
        ],
        premium: [
            { name: "Park Hyatt Tokyo", price: 15000, rating: 4.6, link: "https://www.booking.com/hotel/jp/park-hyatt-tokyo.html" },
            { name: "Keio Plaza", price: 12000, rating: 4.5, link: "https://www.booking.com/hotel/jp/keio-plaza-hotel-tokyo.html" }
        ],
        luxury: [
            { name: "Aman Tokyo", price: 35000, rating: 4.9, link: "https://www.booking.com/hotel/jp/aman-tokyo.html" },
            { name: "The Peninsula", price: 40000, rating: 4.8, link: "https://www.booking.com/hotel/jp/the-peninsula-tokyo.html" }
        ]
    },
    'Rome': {
        budget: [
            { name: "Hotel Art", price: 4500, rating: 4.0, link: "https://www.booking.com/hotel/it/hotel-art.html" },
            { name: "Ibis Roma", price: 4000, rating: 4.1, link: "https://www.booking.com/hotel/it/ibis-roma.html" }
        ],
        premium: [
            { name: "Hotel Eden", price: 15000, rating: 4.7, link: "https://www.booking.com/hotel/it/hotel-eden-rome.html" },
            { name: "Rocco Forte", price: 12000, rating: 4.6, link: "https://www.booking.com/hotel/it/rocco-forte-hotel-de-la-ville.html" }
        ],
        luxury: [
            { name: "Hotel Hassler", price: 35000, rating: 4.9, link: "https://www.booking.com/hotel/it/hotel-hassler-roma.html" },
            { name: "Ritz-Carlton", price: 30000, rating: 4.8, link: "https://www.booking.com/hotel/it/ritz-carlton-rome.html" }
        ]
    },
    'Bali': {
        budget: [
            { name: "Hotel Tjendana", price: 3000, rating: 4.0, link: "https://www.booking.com/hotel/id/hotel-tjendana.html" },
            { name: "Tropical", price: 3500, rating: 4.1, link: "https://www.booking.com/hotel/id/tropical-bali.html" }
        ],
        premium: [
            { name: "Four Seasons", price: 12000, rating: 4.7, link: "https://www.booking.com/hotel/id/four-seasons-bali.html" },
            { name: "Maya Ubud", price: 9000, rating: 4.6, link: "https://www.booking.com/hotel/id/maya-resort-bali.html" }
        ],
        luxury: [
            { name: "The Mulia", price: 20000, rating: 4.8, link: "https://www.booking.com/hotel/id/the-mulia-bali.html" },
            { name: "COMO Uma", price: 18000, rating: 4.9, link: "https://www.booking.com/hotel/id/como-uma-ubud.html" }
        ]
    },
    'Goa': {
        budget: [
            { name: "Hotel Soni", price: 1500, rating: 3.8, link: "https://www.booking.com/hotel/in/hotel-soni-goa.html" },
            { name: "Sea Pearl Beach Resort", price: 2000, rating: 4.0, link: "https://www.booking.com/hotel/in/sea-pearl-beach-resort.html" }
        ],
        premium: [
            { name: "Taj Holiday Village", price: 8000, rating: 4.5, link: "https://www.booking.com/hotel/in/taj-holiday-village-goa.html" },
            { name: "The Leela Goa", price: 10000, rating: 4.7, link: "https://www.booking.com/hotel/in/the-leela-goa.html" }
        ],
        luxury: [
            { name: "Taj Fort Aguada", price: 15000, rating: 4.8, link: "https://www.booking.com/hotel/in/taj-fort-aguada.html" },
            { name: "Alila Diwa Goa", price: 12000, rating: 4.6, link: "https://www.booking.com/hotel/in/alila-diwa-goa.html" }
        ]
    },
    'Mumbai': {
        budget: [
            { name: "Hotel Sea Princess", price: 3000, rating: 3.9, link: "https://www.booking.com/hotel/in/hotel-sea-princess.html" },
            { name: "Hotel Apex", price: 2500, rating: 3.7, link: "https://www.booking.com/hotel/in/hotel-apex-mumbai.html" }
        ],
        premium: [
            { name: "Taj Lands End", price: 12000, rating: 4.6, link: "https://www.booking.com/hotel/in/taj-lands-end.html" },
            { name: "The St. Regis Mumbai", price: 15000, rating: 4.7, link: "https://www.booking.com/hotel/in/the-st-regis-mumbai.html" }
        ],
        luxury: [
            { name: "Taj Palace Hotel", price: 18000, rating: 4.8, link: "https://www.booking.com/hotel/in/taj-palace-mumbai.html" },
            { name: "The Oberoi Mumbai", price: 20000, rating: 4.9, link: "https://www.booking.com/hotel/in/the-oberoi-mumbai.html" }
        ]
    },
    'Delhi': {
        budget: [
            { name: "Hotel Amax Inn", price: 1800, rating: 3.6, link: "https://www.booking.com/hotel/in/hotel-amax-inn.html" },
            { name: "Bloomrooms New Delhi", price: 2500, rating: 4.1, link: "https://www.booking.com/hotel/in/bloomrooms-plus.html" }
        ],
        premium: [
            { name: "Taj Palace New Delhi", price: 12000, rating: 4.6, link: "https://www.booking.com/hotel/in/taj-palace-delhi.html" },
            { name: "The Leela Palace", price: 15000, rating: 4.7, link: "https://www.booking.com/hotel/in/the-leela-palace-new-delhi.html" }
        ],
        luxury: [
            { name: "The Imperial New Delhi", price: 18000, rating: 4.8, link: "https://www.booking.com/hotel/in/the-imperial.html" },
            { name: "Taj Diplomatic Enclave", price: 22000, rating: 4.9, link: "https://www.booking.com/hotel/in/taj-diplomatic-enclave.html" }
        ]
    },
    'Jaipur': {
        budget: [
            { name: "Hotel Kalyan", price: 1500, rating: 3.8, link: "https://www.booking.com/hotel/in/hotel-kalyan-jaipur.html" },
            { name: "Umaid Bhawan", price: 2000, rating: 4.0, link: "https://www.booking.com/hotel/in/umaid-bhawan-jaipur.html" }
        ],
        premium: [
            { name: "Taj Jai Mahal Palace", price: 8000, rating: 4.7, link: "https://www.booking.com/hotel/in/taj-jai-mahal-palace.html" },
            { name: "Rajputana Palace", price: 5500, rating: 4.4, link: "https://www.booking.com/hotel/in/rajputana-palace-jaipur.html" }
        ],
        luxury: [
            { name: "Taj Rambagh Palace", price: 25000, rating: 4.9, link: "https://www.booking.com/hotel/in/taj-rambagh-palace.html" },
            { name: "Fairmont Jaipur", price: 18000, rating: 4.8, link: "https://www.booking.com/hotel/in/fairmont-jaipur.html" }
        ]
    },
    'Kerala': {
        budget: [
            { name: "Hotel Presidency", price: 1800, rating: 3.7, link: "https://www.booking.com/hotel/in/hotel-presidency-kochi.html" },
            { name: "Dream Catcher", price: 2200, rating: 4.0, link: "https://www.booking.com/hotel/in/dream-catcher-homestay.html" }
        ],
        premium: [
            { name: "Taj Malabar Resort", price: 9000, rating: 4.7, link: "https://www.booking.com/hotel/in/taj-malabar-resort-spa.html" },
            { name: "Brunton Boatyard", price: 7500, rating: 4.6, link: "https://www.booking.com/hotel/in/brunton-boatyard.html" }
        ],
        luxury: [
            { name: "Taj Kumarakom", price: 15000, rating: 4.8, link: "https://www.booking.com/hotel/in/taj-kumarakom.html" },
            { name: "Kalari Kovilakom", price: 12000, rating: 4.7, link: "https://www.booking.com/hotel/in/kalari-kovilakom.html" }
        ]
    },
    'Bangalore': {
        budget: [
            { name: "Hotel Ayaan", price: 1800, rating: 3.5, link: "https://www.booking.com/hotel/in/hotel-ayaan-bangalore.html" },
            { name: "Treebo Trend", price: 2200, rating: 4.0, link: "https://www.booking.com/hotel/in/treebo-trend-bangalore.html" }
        ],
        premium: [
            { name: "The Ritz-Carlton", price: 12000, rating: 4.8, link: "https://www.booking.com/hotel/in/the-ritz-carlton-bangalore.html" },
            { name: "Taj West End", price: 9000, rating: 4.7, link: "https://www.booking.com/hotel/in/taj-west-end-bangalore.html" }
        ],
        luxury: [
            { name: "The Leela Palace", price: 15000, rating: 4.9, link: "https://www.booking.com/hotel/in/the-leela-palace-bangalore.html" },
            { name: "Four Seasons", price: 18000, rating: 4.8, link: "https://www.booking.com/hotel/in/four-seasons-bangalore.html" }
        ]
    },
    'Mysore': {
        budget: [
            { name: "Hotel Rocose", price: 1500, rating: 3.8, link: "https://www.booking.com/hotel/in/hotel-rocose-mysore.html" },
            { name: "Paradise Hotel", price: 1800, rating: 4.0, link: "https://www.booking.com/hotel/in/paradise-hotel-mysore.html" }
        ],
        premium: [
            { name: "Radisson Blu", price: 5500, rating: 4.5, link: "https://www.booking.com/hotel/in/radisson-blu-mysore.html" },
            { name: "Taj Yeshwathpur", price: 6500, rating: 4.6, link: "https://www.booking.com/hotel/in/taj-yeshwathpur.html" }
        ],
        luxury: []
    },
    'Rameswaram': {
        budget: [
            { name: "Hotel Vasanth", price: 1200, rating: 3.5, link: "https://www.booking.com/hotel/in/hotel-vasanth-rameswaram.html" },
            { name: "Hotel SS Grand", price: 1500, rating: 3.8, link: "https://www.booking.com/hotel/in/hotel-ss-grand-rameswaram.html" }
        ],
        premium: [
            { name: "Hotel Ramanath", price: 3500, rating: 4.2, link: "https://www.booking.com/hotel/in/hotel-ramanath-rameswaram.html" },
            { name: "Taj Rameshwaram", price: 6000, rating: 4.5, link: "https://www.booking.com/hotel/in/taj-rameshwaram.html" }
        ],
        luxury: []
    },
    'Kochi': {
        budget: [
            { name: "Hotel Elite", price: 1500, rating: 3.6, link: "https://www.booking.com/hotel/in/hotel-elite-kochi.html" },
            { name: "Treebo Trend", price: 2000, rating: 4.0, link: "https://www.booking.com/hotel/in/treebo-trend-kochi.html" }
        ],
        premium: [
            { name: "Taj Malabar", price: 7500, rating: 4.6, link: "https://www.booking.com/hotel/in/taj-malabar-kochi.html" },
            { name: "Brunton Boatyard", price: 8000, rating: 4.7, link: "https://www.booking.com/hotel/in/brunton-boatyard.html" }
        ],
        luxury: []
    },
    'Munnar': {
        budget: [
            { name: "Hotel Spice", price: 1800, rating: 3.9, link: "https://www.booking.com/hotel/in/hotel-spice-munnar.html" },
            { name: "Misty Lake Resort", price: 2200, rating: 4.1, link: "https://www.booking.com/hotel/in/misty-lake-resort.html" }
        ],
        premium: [
            { name: "Taj Munnar", price: 8000, rating: 4.7, link: "https://www.booking.com/hotel/in/taj-munnar.html" },
            { name: "The Leaf Munnar", price: 6500, rating: 4.5, link: "https://www.booking.com/hotel/in/the-leaf-munnar.html" }
        ],
        luxury: [
            { name: "Tata Tea County", price: 10000, rating: 4.8, link: "https://www.booking.com/hotel/in/tata-tea-county.html" }
        ]
    },
    'Pune': {
        budget: [
            { name: "Hotel Shree", price: 1800, rating: 3.5, link: "https://www.booking.com/hotel/in/hotel-shree-pune.html" },
            { name: "oyo Townhouse", price: 2000, rating: 4.0, link: "https://www.booking.com/hotel/in/oyo-townhouse-pune.html" }
        ],
        premium: [
            { name: "Taj Blue Diamond", price: 8000, rating: 4.6, link: "https://www.booking.com/hotel/in/taj-blue-diamond.html" },
            { name: "St Regis Pune", price: 10000, rating: 4.7, link: "https://www.booking.com/hotel/in/the-st-regis-pune.html" }
        ],
        luxury: []
    },
    'Udaipur': {
        budget: [
            { name: "Hotel Swaroop", price: 1500, rating: 3.5, link: "https://www.booking.com/hotel/in/hotel-swaroop-udaipur.html" },
            { name: "Hotel Devra", price: 1800, rating: 3.8, link: "https://www.booking.com/hotel/in/hotel-devra-udaipur.html" }
        ],
        premium: [
            { name: "Taj Lake Palace", price: 12000, rating: 4.9, link: "https://www.booking.com/hotel/in/taj-lake-palace-udaipur.html" },
            { name: "Leela Palace", price: 10000, rating: 4.7, link: "https://www.booking.com/hotel/in/the-leela-palace-udaipur.html" }
        ],
        luxury: [
            { name: "Aman Udai", price: 15000, rating: 4.8, link: "https://www.booking.com/hotel/in/aman-udai.html" }
        ]
    },
    'Manali': {
        budget: [
            { name: "Hotel Mountain", price: 1200, rating: 3.5, link: "https://www.booking.com/hotel/in/hotel-mountain-manali.html" },
            { name: "Apple Rose", price: 1500, rating: 3.8, link: "https://www.booking.com/hotel/in/apple-rose-manali.html" }
        ],
        premium: [
            { name: "Taj Manali", price: 8000, rating: 4.7, link: "https://www.booking.com/hotel/in/taj-manali.html" },
            { name: "The Himalayan", price: 6500, rating: 4.5, link: "https://www.booking.com/hotel/in/the-himalayan-manali.html" }
        ],
        luxury: []
    },
    'Shimla': {
        budget: [
            { name: "Hotel White", price: 1500, rating: 3.6, link: "https://www.booking.com/hotel/in/hotel-white-shimla.html" },
            { name: "Hotel De Sov", price: 1800, rating: 3.9, link: "https://www.booking.com/hotel/in/hotel-de-sov-shimla.html" }
        ],
        premium: [
            { name: "Taj Shimla", price: 8000, rating: 4.7, link: "https://www.booking.com/hotel/in/taj-shimla.html" },
            { name: "Wildflower Hall", price: 12000, rating: 4.9, link: "https://www.booking.com/hotel/in/wildflower-hall.html" }
        ],
        luxury: []
    },
    'Hyderabad': {
        budget: [
            { name: "Hotel Hyaat", price: 1800, rating: 3.5, link: "https://www.booking.com/hotel/in/hotel-hyaat-hyderabad.html" },
            { name: "oyo Townhouse", price: 2000, rating: 4.0, link: "https://www.booking.com/hotel/in/oyo-townhouse-hyderabad.html" }
        ],
        premium: [
            { name: "Taj Falaknuma", price: 12000, rating: 4.9, link: "https://www.booking.com/hotel/in/taj-falaknuma-palace.html" },
            { name: "Park Hyatt", price: 9000, rating: 4.6, link: "https://www.booking.com/hotel/in/park-hyderabad.html" }
        ],
        luxury: [
            { name: "Taj Deccan", price: 10000, rating: 4.7, link: "https://www.booking.com/hotel/in/taj-deccan-hyderabad.html" }
        ]
    },
    'Varanasi': {
        budget: [
            { name: "Hotel Temple", price: 1200, rating: 3.5, link: "https://www.booking.com/hotel/in/hotel-temple-varanasi.html" },
            { name: "Hotel Pradeep", price: 1500, rating: 3.8, link: "https://www.booking.com/hotel/in/hotel-pradeep-varanasi.html" }
        ],
        premium: [
            { name: "Taj Nadesar", price: 7000, rating: 4.6, link: "https://www.booking.com/hotel/in/taj-nadesar-varanasi.html" },
            { name: "BrijRama Palace", price: 8000, rating: 4.7, link: "https://www.booking.com/hotel/in/brijrama-palace.html" }
        ],
        luxury: []
    }
};

module.exports = hotelData;
