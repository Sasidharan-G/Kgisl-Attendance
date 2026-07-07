import java.awt.*;
import javax.swing.*;

public class FacultieView extends JFrame {

    public FacultieView() {
        setTitle("Faculty - Student Details");
        setSize(900, 400);
        setLocationRelativeTo(null);

        String[] columns = {
            "Name", "Reg No", "Java", "OS", "CN",
            "D.Net", "DBMS", "Total", "Average", "Grade"
        };

        Object[][] data = new Object[StudentDatabase.list.size()][10];

        for (int i = 0; i < StudentDatabase.list.size(); i++) {
            StudentDetail s = StudentDatabase.list.get(i);

            data[i][0] = s.name;
            data[i][1] = s.reg;
            data[i][2] = s.java;
            data[i][3] = s.os;
            data[i][4] = s.cn;
            data[i][5] = s.dnet;
            data[i][6] = s.dbms;
            data[i][7] = s.total;
            data[i][8] = s.avg;
            data[i][9] = s.grade;
        }

        JTable table = new JTable(data, columns);
        table.setRowHeight(25);
        table.getTableHeader().setFont(new Font("Arial", Font.BOLD, 15));

        add(new JScrollPane(table));
        setVisible(true);
    }
}

