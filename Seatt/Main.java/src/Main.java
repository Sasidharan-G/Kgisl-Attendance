import java.util.Scanner;

public class Main {
    public static void main(String[] args) {

        Scanner input = new Scanner(System.in);

        int Studentchoice;
        int OverallChoice;
        int Adminchoice;
         

       boolean run = true;
       boolean isLoggedIn = false;

while (run) {

    System.out.println("\n***** MAIN LOGIN *****");
    System.out.println("1. Admin Login");
    System.out.println("2. Student Login");
    System.out.println("3. Exit");
    System.out.print("Enter choice: ");

    OverallChoice = input.nextInt();

    switch (OverallChoice) {

        case 1: 
            do {
                System.out.println("\n--- Admin Page ---");
                System.out.println("1. View All");
                System.out.println("2. Cancellation");
                System.out.println("3. Exit Admin");
                System.out.print("Enter choice: ");

                Adminchoice = input.nextInt();

                switch (Adminchoice) {
                    case 1:
                        Admin.viewAll();
                        break;
                    case 2:
                        Admin.cancellation();
                        break;
                    case 3:
                        System.out.println("Admin Exit...");
                        System.exit(0); 
                    default:
                        System.out.println("Invalid choice!");
                }

            } while (Adminchoice != 3);
            break;

            case 2:
          

            do {
                System.out.println("\n--- Student Menu ---");
                System.out.println("0. Student Login");
                System.out.println("1. Assign Seat");
                System.out.println("2. Check Availability");
                System.out.println("3. Reset Seating");
                System.out.println("4. Student Exit");
                System.out.print("Enter choice: ");

                Studentchoice = input.nextInt();
                input.nextLine();

                switch (Studentchoice) {

                    case 0:
                        System.out.print("Enter Username: ");
                        String StdNa = input.nextLine();

                        System.out.print("Enter Password: ");
                        String Stdpas = input.nextLine();

                        if (StdNa.equals("Kgisliim") && Stdpas.equals("1234")) {
                            isLoggedIn = true;
                            System.out.println("Login Successful");
                        } else {
                            System.out.println("Invalid Username or Password");
                        }
                        break;

                    case 1:
                        if (isLoggedIn) Seat.assignSeatRandom();
                        else System.out.println("Please login first!");
                        break;

                    case 2:
                        if (isLoggedIn) Seat.checkAvailability();
                        else System.out.println("Please login first!");
                        break;

                    case 3:
                        if (isLoggedIn) Seat.resetSeating();
                        else System.out.println("Please login first!");
                        break;

                    case 4:
                        System.out.println("Returning to Main Menu...");
                        break;

                    default:
                        System.out.println("Invalid choice!");
                }

            } while (Studentchoice != 4);
            break;
            
        } 
    }
}
}