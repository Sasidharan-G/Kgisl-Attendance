import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.Scanner;

public class Admin {

     static Scanner input = new Scanner(System.in);
    static HashMap<Integer, String> seatMap = new HashMap<>();
    static Random random = new Random();


     static void viewAll() {
        if (seatMap.isEmpty()) {
            System.out.println("No seat allocations found");
        } else {
            System.out.println("\nSeat No\tStudent Name");
            System.out.println("----------------------");
            for (Map.Entry<Integer, String> entry : seatMap.entrySet()) {
                System.out.println(entry.getKey() + "\t" + entry.getValue());
            }
        }
    }
    
    static void cancellation() {
        System.out.print("Enter Seat Number to cancel: ");
        int seat = input.nextInt();

        if (seatMap.containsKey(seat)) {
            seatMap.remove(seat);
            System.out.println("Seat cancelled successfully");
        } else {
            System.out.println("Seat not found");
        }
    }
    
   
    
}
