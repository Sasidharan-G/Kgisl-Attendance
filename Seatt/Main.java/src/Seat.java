import java.util.HashMap;
import java.util.Random;
import java.util.Scanner;

public class Seat {

    static Scanner input = new Scanner(System.in);
    static HashMap<Integer, String> seatMap = new HashMap<>();
    static Random random = new Random();
    static final int AVAILABILITY = 50;

    
    static void assignSeatRandom() {
        // input.nextLine();
        System.out.print("Enter Student Name: ");
        String name = input.nextLine();

        if (seatMap.containsValue(name)) {
            System.out.println("Student already has a seat!");
            return;
        }

        if (seatMap.size() == AVAILABILITY) {
            System.out.println("All seats are filled!");
            return;
        }

        int seat;
        do {
            seat = random.nextInt(AVAILABILITY) + 1;
        } while (seatMap.containsKey(seat));

        seatMap.put(seat, name);
        System.out.println("Seat allocated successfully!");
        System.out.println("Assigned Seat Number: " + seat);
    }

    static void checkAvailability() {
        System.out.print("Enter Seat Number: ");
        int seat = input.nextInt();

        if (seatMap.containsKey(seat)) {
            System.out.println("Seat occupied by: " + seatMap.get(seat));
        } else {
            System.out.println("Seat is available");
        }
    }


    static void resetSeating() {
        seatMap.clear();
        System.out.println("All seating reset successfully");
    }


}
