import java.util.ArrayList;

public class StudentDatabase{
    public static ArrayList<StudentDetail> list = new ArrayList<>();

    public static void addStudent(StudentDetail s) {
        list.add(s);
    }
}

