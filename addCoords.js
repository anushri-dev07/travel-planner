const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://AnuShriJ:anu2007@travelplannercluster.niroqe2.mongodb.net/travelPlanner?retryWrites=true&w=majority')
.then(async () => {
  const db = mongoose.connection.db;
  
  const cityCoords = {
    'Chennai': { lat: 13.0827, lng: 80.2707 },
    'Madurai': { lat: 9.9252, lng: 78.1198 },
    'Coimbatore': { lat: 11.0168, lng: 76.9558 },
    'Ooty': { lat: 11.4102, lng: 76.6950 },
    'Rameswaram': { lat: 9.2856, lng: 79.3124 },
    'Trichy': { lat: 10.7905, lng: 78.7047 },
    'Kanyakumari': { lat: 8.0883, lng: 77.5385 },
    'Bangalore': { lat: 12.9716, lng: 77.5946 },
    'Mysore': { lat: 12.2958, lng: 76.6394 },
    'Kochi': { lat: 9.9312, lng: 76.2673 },
    'Munnar': { lat: 10.0889, lng: 77.0595 },
    'Mumbai': { lat: 19.0760, lng: 72.8777 },
    'Pune': { lat: 18.5204, lng: 73.8567 },
    'Delhi': { lat: 28.7041, lng: 77.1025 },
    'Jaipur': { lat: 26.9124, lng: 75.7873 },
    'Udaipur': { lat: 24.5854, lng: 73.7125 },
    'Agra': { lat: 27.1767, lng: 78.0081 },
    'Varanasi': { lat: 25.3176, lng: 82.9739 },
    'Goa': { lat: 15.2993, lng: 74.1240 },
    'Manali': { lat: 32.2397, lng: 77.1887 },
    'Shimla': { lat: 31.1048, lng: 77.1734 },
    'Haridwar': { lat: 29.9458, lng: 78.1642 },
    'Rishikesh': { lat: 30.0869, lng: 78.2676 },
    'Hyderabad': { lat: 17.3850, lng: 78.4867 },
    'Visakhapatnam': { lat: 17.6860, lng: 83.2185 },
    'Kolkata': { lat: 22.5726, lng: 88.3639 },
    'Darjeeling': { lat: 27.0410, lng: 88.2665 },
    'Ahmedabad': { lat: 23.0225, lng: 72.5714 },
    'Amritsar': { lat: 31.6340, lng: 74.8723 },
    'Chandigarh': { lat: 30.7333, lng: 76.7794 },
    'Paris': { lat: 48.8566, lng: 2.3522 },
    'New York': { lat: 40.7128, lng: -74.0060 },
    'Singapore': { lat: 1.3521, lng: 103.8198 },
    'Bangkok': { lat: 13.7563, lng: 100.5018 },
    'Dubai': { lat: 25.2048, lng: 55.2708 },
    'London': { lat: 51.5074, lng: -0.1278 }
  };
  
  let count = 0;
  for (const [name, coords] of Object.entries(cityCoords)) {
    const result = await db.collection('cities').updateOne(
      { name: name },
      { $set: { lat: coords.lat, lng: coords.lng } }
    );
    if (result.modifiedCount > 0) {
      console.log('Updated:', name);
      count++;
    }
  }
  
  console.log('Done! Total updated:', count);
  process.exit(0);
});
