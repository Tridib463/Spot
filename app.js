import express from "express"
import { initializeApp } from "firebase/app"
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore"
import { getDatabase, ref, set, get } from "firebase/database"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAmrhB_wmnb7nuo6UtBJKpLb9m4LYY0Npg",
  authDomain: "carparking-cad53.firebaseapp.com",
  databaseURL:
    "https://carparking-cad53-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "carparking-cad53",
  storageBucket: "carparking-cad53.appspot.com",
  messagingSenderId: "498577310570",
  appId: "1:498577310570:web:f18e0e6b2c2bd91797db13",
  measurementId: "G-Y85RK81W3X",
}

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig)
const db = getFirestore(firebaseApp)
const rtdb = getDatabase(firebaseApp)

// Initialize Express
const app = express()
const PORT = process.env.PORT

// Middleware
app.use(express.json())

//display the Users
const fetchUsers = async (req, res) => {
  try {
    // Reference to the 'Users' collection
    const colRef = collection(db, "Users")

    // Fetch documents with async/await
    const snapshot = await getDocs(colRef)

    // Map through snapshot docs and extract data
    const users = snapshot.docs.map((doc) => ({
      id: doc.id, // Capture document ID
      ...doc.data(), // Capture the document data
    }))

    // Log or return the users array
    console.log(users)
    res.json(users)
  } catch (error) {
    console.error("Error fetching documents: ", error)
    res.status(500).json({ message: "Error fetching users" })
  }
}

const checkAndUpdateUserAccess = async (req, res) => {
  const { phone } = req.body

  if (!phone) {
    return res.status(400).json({ message: "Phone number is required" })
  }

  try {
    const usersRef = collection(db, "Users")
    const q = query(usersRef, where("Phone", "==", Number(phone)))

    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return res.status(404).json({ message: "User not found" })
    }

    const userDoc = querySnapshot.docs[0]

    await updateDoc(userDoc.ref, {
      Access: true,
      TimeIn: serverTimestamp(),
    })

    // Control the servo motor
    const rtdb = getDatabase()
    const servoRef = ref(rtdb, "servoControl")

    // Set servo to 1
    await set(servoRef, 1)
    console.log("Servo set to 1")

    // Verify the value was set
    const snapshot = await get(servoRef)
    console.log("Current servo value:", snapshot.val())

    // Wait for 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 3500))

    // Set servo back to 0
    await set(servoRef, 0)
    console.log("Servo set back to 0")

    // Verify the value was set back to 0
    const finalSnapshot = await get(servoRef)
    console.log("Final servo value:", finalSnapshot.val())

    // Fetch the updated document
    const updatedDoc = await getDocs(
      query(usersRef, where("Phone", "==", Number(phone)))
    )
    const updatedUserData = updatedDoc.docs[0].data()

    res.json({
      message: "User access updated successfully and servo controlled",
      user: {
        name: updatedUserData.Name,
        phone: updatedUserData.Phone,
        access: updatedUserData.Access,
        timeIn: updatedUserData.TimeIn ? updatedUserData.TimeIn.toDate() : null,
        timeOut: updatedUserData.TimeOut
          ? updatedUserData.TimeOut.toDate()
          : null,
      },
    })
  } catch (error) {
    console.error("Error checking/updating user or controlling servo:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

const checkOUT = async (req, res) => {
  const { phone } = req.body

  if (!phone) {
    return res.status(400).json({ message: "Phone number is required" })
  }

  try {
    const db = getFirestore()
    const usersRef = collection(db, "Users")
    const q = query(usersRef, where("Phone", "==", Number(phone)))

    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return res.status(404).json({ message: "User not found" })
    }

    const userDoc = querySnapshot.docs[0]
    const userData = userDoc.data()

    // 1. Update TimeOut in Firestore
    const timeOut = serverTimestamp()
    await updateDoc(userDoc.ref, {
      TimeOut: timeOut,
    })

    // 2. Calculate Amount to be paid
    const timeIn = userData.TimeIn.toDate()
    const timeOutDate = new Date() // Use current time as timeOut
    const durationInMinutes = Math.ceil((timeOutDate - timeIn) / (1000 * 60))
    const amountToPay = durationInMinutes * 1 // 1 Rs. per minute

    // Fetch the updated user document
    const updatedDoc = await getDocs(q)
    const updatedUserData = updatedDoc.docs[0].data()

    res.json({
      message: "User checked out successfully",
      user: {
        name: updatedUserData.Name,
        phone: updatedUserData.Phone,
        timeIn: updatedUserData.TimeIn ? updatedUserData.TimeIn.toDate() : null,
        timeOut: updatedUserData.TimeOut
          ? updatedUserData.TimeOut.toDate()
          : null,
        durationInMinutes,
        amountToPay,
      },
    })
  } catch (error) {
    console.error("Error during checkout process:", error)
    res.status(500).json({ message: "Internal server error during checkout" })
  }
}

const AMOUNT = async (req, res) => {
  const { phone } = req.body

  if (!phone) {
    return res.status(400).json({ message: "Phone number is required" })
  }

  try {
    // 3. Control the servo motor
    const rtdb = getDatabase()
    const servoRef = ref(rtdb, "servoControl")

    // Set servo to 1
    await set(servoRef, 1)
    console.log("Servo set to 1 for checkout")

    // Wait for 3.5 seconds
    await new Promise((resolve) => setTimeout(resolve, 3500))

    // Set servo back to 0
    await set(servoRef, 0)
    console.log("Servo set back to 0 after checkout")

    // Verify the final servo value
    const finalSnapshot = await get(servoRef)
    console.log("Final servo value after checkout:", finalSnapshot.val())

    res.json({
      message: "User Successfully Paid the AMount",
    })
  } catch (error) {
    console.error("Error during checkout process:", error)
    res.status(500).json({ message: "Internal server error during checkout" })
  }
}

// Routes
app.post("/checkIN", checkAndUpdateUserAccess)
app.post("/checkOUT", checkOUT)
app.post("/AMOUNT", AMOUNT)
app.get("/users", fetchUsers)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: "Something went wrong!" })
})

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
