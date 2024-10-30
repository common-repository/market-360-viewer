<?php

if(preg_match('#' . basename(__FILE__) . '#', $_SERVER['PHP_SELF'])) { die('You are not allowed to call this page directly.'); }

/**
 * Plugin Name: Market360 Viewer
 * Plugin URI: http://market360.co/wp-viewer
 * Description: This plugin helps you easly put Market360 presentation on your site using shortcodes.
 * Version: 1.01
 * Author: Market360.co
 * Author URI: http://Market360.co
 * License: GPL2
 */

if(!class_exists('WP_List_Table')){
	require_once( ABSPATH . 'wp-admin/includes/class-wp-list-table.php' );
}

class M360_List_Table extends WP_List_Table {

   /**
    * Constructor, we override the parent to pass our own arguments
    * We usually focus on three parameters: singular and plural labels, as well as whether the class supports AJAX.
    */
   function __construct() {
   	global $status, $page;

   	parent::__construct( array(
      'singular'=> 'wp_list_text_m360', //Singular label
      'plural' => 'wp_list_test_m360', //plural label, also this well be one of the table css class
      'ajax'   => false //We won't support Ajax for this table
      ) );
   }

   function column_default($item, $column_name){
   	switch($column_name){
   		case 'name':
   		$link = add_query_arg(
   			array(
	                'page' => 'market360-presentation-details-page', // as defined in the hidden page
	                'id' => $item['id']
	                ),
   			admin_url('admin.php')
   			);
   		return sprintf('<a href="%s">%s</a>',$link,$item[$column_name]);
   		case 'time':
   		case 'id':
   		case 'width':
   		case 'height':
   		return $item[$column_name];
   		case 'thumb':
   		$thumb = $item['path'] . $item['thumb'];
   		return sprintf('<img src="%s" style="width:60px;height:60px"/>',$thumb);
   		case 'shortcode':
   		return sprintf('[m360 id=%s w=%s h=%s]',$item['id'],$item['width'],$item['height']);
   		default:
                return print_r($item,true); //Show the whole array for troubleshooting purposes
            }
        }

        function column_title($item){

        //Build row actions
        	$actions = array(
        		'edit'      => sprintf('<a href="?page=%s&action=%s&movie=%s">Edit</a>',$_REQUEST['page'],'edit',$item['ID']),
        		'delete'    => sprintf('<a href="?page=%s&action=%s&movie=%s">Delete</a>',$_REQUEST['page'],'delete',$item['ID']),
        		);

        //Return the title contents
        	return sprintf('%1$s <span style="color:silver">(id:%2$s)</span>%3$s',
        		/*$1%s*/ $item['name'],
        		/*$2%s*/ $item['id'],
        		/*$3%s*/ $this->row_actions($actions)
        		);
        }

        function column_cb($item){
        	return sprintf(
        		'<input type="checkbox" name="%1$s[]" value="%2$s" />',
            /*$1%s*/ $this->_args['singular'],  //Let's simply repurpose the table's singular label ("movie")
            /*$2%s*/ $item['id']                //The value of the checkbox should be the record's id
            );
        }

/**
 * Define the columns that are going to be used in the table
 * @return array $columns, the array of columns to use with the table
 */
function get_columns(){
	$columns = array(
            //'cb'        => '<input type="checkbox" />', //Render a checkbox instead of text
		'thumb'		=> '',
		'id'		=> 'ID',
		'name'     	=> 'Name',
		'width'		=> 'Width',
		'height'	=> 'Height',
		'shortcode' => 'Shortcode',
		'time'  => 'Uploaded'
		);
	return $columns;
}

/**
 * Decide which columns to activate the sorting functionality on
 * @return array $sortable, the array of columns that can be sorted by the user
 */
function get_sortable_columns() {
	$sortable_columns = array(
		'id'		=> array('id',false),
        'name'      => array('name',false),     //true means it's already sorted
        'time' 		=> array('time',false)
        );
	return $sortable_columns;
}

// function get_bulk_actions() {
// 	$actions = array(
// 		'delete'    => 'Delete'
// 		);
// 	return $actions;
// }

function process_bulk_action() {

        //Detect when a bulk action is being triggered...
	if( 'delete'===$this->current_action() ) {
		wp_die('Items deleted (or they would be if we had items to delete)!');
	}

}

function extra_tablenav( $which ) {
	if ( $which == "top" ){
		$link = add_query_arg(
			array(
				'page' => 'market360-viewer-upload'
				),
			admin_url('admin.php')
			);

		echo sprintf('<div class="alignleft actions"><a class="button" style="margin: 1px 0 8px 0" href="%s">%s</a></div>',$link, __('Add presentation','market360-viewer'));
	}
}

function prepare_items() {
	global $wpdb; 

	$per_page = 10;

	$columns = $this->get_columns();
	$hidden = array();
	$sortable = $this->get_sortable_columns();

	$this->_column_headers = array($columns, $hidden, $sortable);

	$this->process_bulk_action();

	$table_name = $wpdb->prefix . 'm360_presentations';
	$data = $wpdb->get_results("SELECT * FROM $table_name ORDER BY id desc", 'ARRAY_A');

	function usort_reorder($a,$b){
            $orderby = (!empty($_REQUEST['orderby'])) ? $_REQUEST['orderby'] : 'id'; //If no sort, default to title
            $order = (!empty($_REQUEST['order'])) ? $_REQUEST['order'] : 'desc'; //If no order, default to asc
            $result = strcmp($a[$orderby], $b[$orderby]); //Determine sort order
            return ($order==='asc') ? $result : -$result; //Send final sort direction to usort
        }
        usort($data, 'usort_reorder');

        $current_page = $this->get_pagenum();

        $total_items = count($data);

        $data = array_slice($data,(($current_page-1)*$per_page),$per_page);

        $this->items = $data;

        $this->set_pagination_args( array(
            'total_items' => $total_items,                  //WE have to calculate the total number of items
            'per_page'    => $per_page,                     //WE have to determine how many items to show on a page
            'total_pages' => ceil($total_items/$per_page)   //WE have to calculate the total number of pages
            ) );
    }

    
}

add_action( 'admin_head', 'admin_header');

function admin_header() {
	$page = ( isset($_GET['page'] ) ) ? esc_attr( $_GET['page'] ) : false;
	if( 'market360-viewer' != $page )
		return; 

	echo '<style type="text/css">';
	echo '.wp-list-table .column-thumb { width: 60px; }';
	echo '.wp-list-table .column-id { width: 60px; }';
	echo '.wp-list-table .column-width { width: 60px; }';
	echo '.wp-list-table .column-height { width: 60px; }';
	echo '.wp-list-table .column-time { width: 200px; }';
	echo '.wp-list-table .column-shortcode { width: 200px; }';
	echo '</style>';
}

global $m360_db_version;
$m360_db_version = '1.11';

function m360_install() {
	global $wpdb;
	global $m360_db_version;

	$table_name = $wpdb->prefix . 'm360_presentations';

	$charset_collate = '';

	if ( ! empty( $wpdb->charset ) ) {
		$charset_collate = "DEFAULT CHARACTER SET {$wpdb->charset}";
	}

	if ( ! empty( $wpdb->collate ) ) {
		$charset_collate .= " COLLATE {$wpdb->collate}";
	}

	$sql = "CREATE TABLE $table_name (
		id mediumint(9) NOT NULL AUTO_INCREMENT,
		time datetime DEFAULT '0000-00-00 00:00:00' NOT NULL,
		name tinytext NOT NULL,
		text text NOT NULL,
		height VARCHAR(255) DEFAULT '400' NOT NULL,
		width VARCHAR(255) DEFAULT '600' NOT NULL,
		path tinytext NOT NULL,
		dir tinytext NOT NULL,
		thumb tinytext NOT NULL,
		UNIQUE KEY id (id)
		) $charset_collate;";

require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
dbDelta( $sql );

add_option( 'm360_db_version', $m360_db_version );
}

register_activation_hook( __FILE__, 'm360_install' );

function m360_update_db_check() {
	global $m360_db_version;
	if ( get_site_option( 'm360_db_version' ) != $m360_db_version ) {
		m360_install();
	}
}
add_action( 'plugins_loaded', 'm360_update_db_check' );

add_action( 'admin_menu', 'market360_viewer_menu' );

function market360_viewer_menu() {

	add_menu_page('360 presentations', 'Market360', 'manage_options', 'market360-viewer','', plugins_url( 'images/market360-logo-15px.jpg' , __FILE__ ));
	add_submenu_page( 'market360-viewer', '360 presentations', 'All 360 presentations', 'manage_options', 'market360-viewer', 'all_presentations_fn');
	add_submenu_page( 'market360-viewer', 'Upload new presentation', 'Add presentation', 'manage_options', 'market360-viewer-upload', 'upload_presentation_fn');
	add_submenu_page( 'options.php', 'Market360 presentation details', 'Market360 presentation details', 'manage_options', 'market360-presentation-details-page', 'market360_presentation_details_page_callback');
}

function all_presentations_fn() {
	if ( !current_user_can( 'manage_options' ) )  {
		wp_die( __( 'You do not have sufficient permissions to access this page.' ) );
	}
	

	global $wpdb;
	$table_name = $wpdb->prefix . 'm360_presentations';
	$results_from_db = $wpdb->get_results("SELECT * FROM $table_name");

	//Prepare Table of elements
	$m360_list_table = new M360_List_Table();
	$m360_list_table->prepare_items();

	?>
	<div class="wrap">
		<h2> <?php _e('All Market360 presentations', 'market360-viewer')?></h2>
		<form id="m360-filter" method="get">
			<!-- For plugins, we also need to ensure that the form posts back to our current page -->
			<input type="hidden" name="page" value="<?php echo $_REQUEST['page'] ?>" />
			<!-- Now we can render the completed list table -->
			<?php $m360_list_table->display() ?>
		</form>
	</div>
	<?php

}

function upload_presentation_fn() {
	//must check that the user has the required capability 
	if (!current_user_can('manage_options'))
	{
		wp_die( __('You do not have sufficient permissions to access this page.') );
	}

	$hidden_field_name = 'm360_submit_h';


    // See if the user has posted us some information
    // If they did, this hidden field will be set to 'Y'
	if( isset($_POST[ $hidden_field_name ]) && $_POST[ $hidden_field_name ] == 'Y' ) {

		$url = wp_nonce_url('admin.php?page=market360-viewer-upload');
		if (false === ($creds = request_filesystem_credentials($url, '', false, false, null) ) ) {
			return; // stop processing here
		}

		if ( ! WP_Filesystem($creds) ) {
			request_filesystem_credentials($url, '', true, false, null);
			return;
		}
		global $wp_filesystem;

		if(!$wp_filesystem->is_dir($wp_filesystem->wp_content_dir() . 'market360/')) 
		{
			/* directory didn't exist, so let's create it */
			$wp_filesystem->mkdir($wp_filesystem->wp_content_dir() . 'market360/');
		}

		if (isset($_FILES["file"])){
			$uploadedfile = $_FILES['file'];

			if ($uploadedfile["type"] == "application/zip")
			{
				$dir = basename($uploadedfile["name"], ".zip") . '/';
				if(!$wp_filesystem->is_dir($wp_filesystem->wp_content_dir() . 'market360/' . $dir )) 
				{
					/* directory didn't exist, so let's create it */
					$wp_filesystem->mkdir($wp_filesystem->wp_content_dir() . 'market360/' . $dir);
					$result = unzip_file($uploadedfile['tmp_name'], $wp_filesystem->wp_content_dir() . 'market360/' . $dir); 

					if($result !== true)
					{
						echo "Something went wrong please try again or contact with Market360 customer service.\n";
					}else{
						global $wpdb;

						$presentation_name = str_replace(array('-','/'), array(' ',''), $dir);

						$table_name = $wpdb->prefix . 'm360_presentations';

						$wpdb->insert( 
							$table_name, 
							array( 
								'time' => current_time( 'mysql' ), 
								'name' => $presentation_name, 
								'dir' => $dir,
								'text' => '',
								'path' => WP_CONTENT_URL . '/market360/' . $dir . $dir,
								'thumb' => 'tiles/tile_001_0600_001_001.jpg'
								) 
							);
						$lastid = $wpdb->insert_id;
						$link = add_query_arg(
							array(
								'page' => 'market360-viewer'
								),
							admin_url('admin.php')
							);
							?>
							<div class="updated"><p><strong><?php echo $presentation_name . ' '; _e('presentation uploaded successfully.', 'market360-viewer' ); ?></strong></p>
								<?php _e('Go to', 'market360-viewer' ); ?> <a href="<?php echo $link; ?>"><?php _e('presentations list.', 'market360-viewer' ); ?></a></div>
								<?php

							}
				}else {
					echo "This presentation is already uploaded.";
				}
			}else {
				echo "Wrong file type. The file have to be .zip archive.";
			}
		}
	}

	echo '<div class="wrap">';
	echo "<h2>" . __( 'Upload new Market360 presentation', 'market360-viewer' ) . "</h2>";
	?>

	<form name="form1" method="post" action="" ENCTYPE="multipart/form-data">
		<input type="hidden" name="<?php echo $hidden_field_name; ?>" value="Y">

		<p>
			<input type="file" name="file"/>
		</p>
		<p class="submit">
			<input type="submit" name="Submit" class="button-primary" value="<?php esc_attr_e('Upload') ?>" />
		</p>

	</form>
</div>

		<?php

}

function market360_presentation_details_page_callback () {
if (!current_user_can('manage_options'))
{
	wp_die( __('You do not have sufficient permissions to access this page.') );
}

$id = ( isset($_GET['id'] ) ) ? esc_attr( $_GET['id'] ) : false;
if( $id == false )
{
	?>
	<div class="wrap">
		<h2> <?php echo __( 'No presentations found', 'market360-viewer' ); ?></h2>
	</div>
	<?php
	return;
} 

$hidden_field_name = 'm360_submit_h';
global $wpdb;
$table_name = $wpdb->prefix . 'm360_presentations';
if( isset($_POST[ $hidden_field_name ]) && $_POST[ $hidden_field_name ] == 'Y' ) {

	$w = $_POST['p_width'];
	$h = $_POST['p_height'];
	$wpdb->update( 
		$table_name, 
		array( 
			'width' => $w,
			'height' => $h 
			), 
		array( 'ID' => $id )
		);
}


$results_from_db = $wpdb->get_row("SELECT * FROM $table_name WHERE id = $id");
if (is_object($results_from_db)){

	if( isset($_GET[ 'action' ]) && $_GET[ 'action' ] == 'delete' ) {
		if (check_admin_referer( 'delete_presentation_'.$results_from_db->id, 'm360_nonce' ))
		{
			$url = wp_nonce_url('admin.php?page=market360-presentation-details-page');
			if (false === ($creds = request_filesystem_credentials($url, '', false, false, null) ) ) {
				return; // stop processing here
			}

			if ( ! WP_Filesystem($creds) ) {
				request_filesystem_credentials($url, '', true, false, null);
				return;
			}
			global $wp_filesystem;
			
			if($wp_filesystem->is_dir($wp_filesystem->wp_content_dir() . 'market360/' . $results_from_db->dir)) 
			{
				$wp_filesystem->delete($wp_filesystem->wp_content_dir() . 'market360/' . $results_from_db->dir, true);
				$wpdb->delete( $table_name, array( 'id' => $results_from_db->id ) );
			}

			$link = add_query_arg(
				array(
					'page' => 'market360-viewer',
					'deleted' => '1'
					),
				admin_url('admin.php')
				);
			header("Location: $link");

			/* Make sure that code below does not get executed when we redirect. */
			exit;
		}
	}else{
		$link = add_query_arg(
			array(
            'page' => 'market360-presentation-details-page', // as defined in the hidden page
            'id' => $results_from_db->id,
            'action' => 'delete'
            ),
			admin_url('admin.php')
			);

			?>
			<div class="wrap">
				<h2> <?php echo $results_from_db->name; ?></h2>

				<script src="<?php echo  plugins_url(); ?>/market-360-viewer/engine/js/Main.js"></script>
				<script src="<?php echo plugins_url(); ?>/market-360-viewer/engine/lib/jquery-1.10.1.min.js"></script>
				<div id="presentationContainer<?php echo $results_from_db->id; ?>"></div>
				<script>
				app = new presentationLib.Main();
				app.setPresentationPaths( "<?php echo  plugins_url(); ?>/market-360-viewer/engine/", "<?php echo $results_from_db->path; ?>" );
				app.injectPresentation("presentationContainer<?php echo $results_from_db->id; ?>" , <?php echo $results_from_db->width; ?>, <?php echo $results_from_db->height; ?>);
				</script>
				<div style="background:#fff;padding:15px; margin-top:15px">
					<form id="m360-details" method="POST">
						<input type="hidden" name="<?php echo $hidden_field_name; ?>" value="Y">
						<h3 style="margin:0px"><?php echo __( 'Details', 'market360-viewer' ); ?></h3>
						<hr/>
						<p>
							<label><?php echo __( 'Size:', 'market360-viewer' ); ?></label>
							<input type="text" style="width:4em; margin-left:2em" name="p_width" value="<?php echo $results_from_db->width; ?>"> x <input type="text" style="width:4em" name="p_height" value="<?php echo $results_from_db->height; ?>">
						</p>
						<p>
							<label>Shortcode:</label> <?php echo sprintf('[m360 id=%s w=%s h=%s]',$results_from_db->id,$results_from_db->width,$results_from_db->height); ?>
						</p>
						<p><input name="save" type="submit" class="button-primary button-large" value="<?php echo __( 'Update' ); ?>"></p>
						<p><a class="submitdelete deletion" onclick="return showNotice.warn();" href="<?php echo wp_nonce_url( $link, 'delete_presentation_'.$results_from_db->id, 'm360_nonce' );?>"><?php echo __( 'Delete Permanently' ); ?></a></p>

					</form>
				</div>
			</div>
			<?php
		}
	}else{
		?>
		<div class="wrap">
			<h2> <?php echo __( 'No presentations found', 'market360-viewer' ); ?></h2>
		</div>
		<?php

	}
}

function market360_viewer_shortcode_fn( $atts ){
	$a = shortcode_atts( array(
		'id' => '0',
		'w' => '600',
		'h' => '400',
		), $atts );

	global $wpdb;
	$id = $a['id'];

	$table_name = $wpdb->prefix . 'm360_presentations';
	$results_from_db = $wpdb->get_row("SELECT * FROM $table_name WHERE id = $id");

	if (is_object($results_from_db)){
		$retval = '';
		// $retval .= '<script src="' . plugins_url() . '/market360-viewer/engine/js/Main.js"></script>';
		// $retval .= '<script src="' . plugins_url() . '/market360-viewer/engine/lib/jquery-1.10.1.min.js"></script>';
		$retval .= '<div id="presentationContainer' . $a['id'] . '"></div>';
		$retval .= '<script>';
		$retval .= '    app = new presentationLib.Main();';
		$retval .= '    app.setPresentationPaths( "' . plugins_url() . '/market-360-viewer/engine/", "' . $results_from_db->path . '" );';
		$retval .= '    app.injectPresentation("presentationContainer' . $a['id'] . '" , ' . $a['w'] .', ' . $a['h'] .');';
		$retval .= '</script>';
		return $retval;
	}

	return '';
}
add_shortcode( 'm360', 'market360_viewer_shortcode_fn' );

function market360_enqueue_script() {
	wp_enqueue_script( 'market360engine', plugins_url() . '/market-360-viewer/engine/js/Main.js', array('jquery'), '1.0.0', false );
}

add_action( 'wp_enqueue_scripts', 'market360_enqueue_script' );

?>